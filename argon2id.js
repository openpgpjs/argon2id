// TODOs:
// - SIMD instructions
// - compute entire segment in wasm (or at least, also the remaining XORs)
// - test on web

import blake2b from "./blake2b.js"
import fs from 'fs';
const KEYBYTES_MAX = 32; // key (optional)
const ADBYTES_MAX = 0xFFFFFFFF; // Math.pow(2, 32) - 1; // associated data (optional)
const VERSION = 0x13;
const TAGBYTES_MAX = 0xFFFFFFFF; // Math.pow(2, 32) - 1;
const TAGBYTES_MIN = 0xFFFFFFFF; // Math.pow(2, 32) - 1;
const NONCEBYTES_MAX = 0xFFFFFFFF; // Math.pow(2, 32) - 1;
const NONCEBYTES_MIN = 8;
const MSGBYTES_MAX = 0xFFFFFFFF;// Math.pow(2, 32) - 1;
const TYPE = 2;  // Argon2id 

const SYNC_POINTS = 4 // Number of synchronization points between lanes per pass TODO do we need this?
const ARGON2_BLOCK_SIZE = 1024;
const ARGON2_PREHASH_DIGEST_LENGTH = 64;
const ARGON2_PREHASH_SEED_LENGTH = 72;


// store n as a little-endian 32-bit Uint8Array inside buf (at buf[i:i+3])
function LE32s(buf, n, i) {
  buf[i+0] = n;
  buf[i+1] = n >>  8;
  buf[i+2] = n >> 16;
  buf[i+3] = n >> 24;
  return buf;
}

/**
 * Store n as a 64-bit LE number in the given buffer (from buf[i] to buf[i+7])
 */
function LE64s(buf, n, i) {
  if (n > Number.MAX_SAFE_INTEGER) throw new Error("LE64: large numbers unsupported")
  buf[i+0] = n;
  buf[i+1] = n >>  8;
  buf[i+2] = n >> 16;
  buf[i+3] = n >> 24;
  // ECMAScript standard has engines convert numbers to 32-bit integers for bitwise operations
  // shifting by 32 or more bits is not supported (https://stackoverflow.com/questions/6729122/javascript-bit-shift-number-wraps)
  const h = Number(BigInt(n) >> BigInt(32))
  buf[i+4] = h;
  buf[i+5] = h >> 8;
  buf[i+6] = h >> 16;
  buf[i+7] = h >> 24;
  return buf;
}

// Reconstruct Uint32 from Uint8Array entries a[i : i+3] (as little-endian)
// NB result must be stored in Uint32Array to avoid overflow
function GET32 (arr, i) {
  // Must load bytes individually since default Uint32 endianness is platform dependant
  return arr[i] |
    (arr[i + 1] << 8) |
    (arr[i + 2] << 16) |
    (arr[i + 3] << 24)
}

const wasmBuffer = fs.readFileSync('wasm.wasm');
let wasmG;

let V = new Uint8Array(64); // no need to keep around all V_i

/**
 * Variable-Length Hash Function H'
 * @param outlen - T
 * @param X - value to hash
 * @param res - output buffer, of length `outlength` or larger
 * @returns 
 */
function H_(outlen, X, res) {
  const V1_in = new Uint8Array(4 + X.length);
  LE32s(V1_in, outlen, 0);
  V1_in.set(X, 4);
  if (outlen <= 64) {
    // H'^T(A) = H^T(LE32(T)||A)
    blake2b(outlen).update(V1_in).digest(res);
    return res
  }

  const r = Math.ceil(outlen / 32) - 2;

  // Let V_i be a 64-byte block and W_i be its first 32 bytes.
  // V_1 = H^(64)(LE32(T)||A)
  // V_2 = H^(64)(V_1)
  // ...
  // V_r = H^(64)(V_{r-1})
  // V_{r+1} = H^(T-32*r)(V_{r})
  // H'^T(X) = W_1 || W_2 || ... || W_r || V_{r+1}
  for (let i = 0; i < r; i++) {
    // TODO lara: have blake2b.digest support a buffer in input? to skip allocating new buffer at each digest()
    blake2b(64).update(i === 0 ? V1_in : V).digest(V);
    // console.log(V)
    // store W_i in result buffer already
    res.set(V.subarray(0, 32), i*32)
  }
  // V_{r+1}
  const V_r1 = new Uint8Array(blake2b(outlen - 32*r).update(V).digest());
  res.set(V_r1, r*32); // TODO can do in place before?

  return res;
}

// compute buf = xs ^ ys
function XOR(buf, xs, ys) {
  if (xs.length != ys.length) throw new Error('XOR expects array of same length');
  for (let i = 0; i < xs.length; i++)
    buf[i] = xs[i] ^ ys[i]
  return buf;
}

let wasmZ;
/**
 * @param {Uint8Array} X (read-only)
 * @param {Uint8Array} Y (read-only)
 * @param {Uint8Array} R - output buffer
 * @returns 
 */
function G(X, Y, R) {
  wasmG(
    new BigUint64Array(X.buffer, X.byteOffset, X.length / BigUint64Array.BYTES_PER_ELEMENT).byteOffset,
    new BigUint64Array(Y.buffer, Y.byteOffset, Y.length / BigUint64Array.BYTES_PER_ELEMENT).byteOffset,
    new BigUint64Array(R.buffer, R.byteOffset, R.length / BigUint64Array.BYTES_PER_ELEMENT).byteOffset,
    wasmZ.byteOffset
  );
  return R;
}

// XOR xs[iX:iX+len] ^= ys[iY:iY+len]
function XORs(xs, ys, iX, iY, len) {
  for (let i = 0; i < len; i++)
    xs[iX + i] = xs[iX + i] ^ ys[iY + i]
}

let ZERO1024;
let prngTmp;
let prngR;

// Generator for data-independent J1, J2. Each `next()` invocation returns a new pair of values.
function* makePRNG(pass, lane, slice, m_, totalPasses, segmentLength, segmentOffset) {
  // For each segment, we do the following. First, we compute the value Z as:
  // Z= ( LE64(r) || LE64(l) || LE64(sl) || LE64(m') || LE64(t) || LE64(y) )
  prngTmp.fill(0)
  const Z = prngTmp.subarray(0, 6 * 8);
  LE64s(Z, pass, 0);
  LE64s(Z, lane, 8);
  LE64s(Z, slice, 16);
  LE64s(Z, m_, 24);
  LE64s(Z, totalPasses, 32);
  LE64s(Z, TYPE, 40);

  // Then we compute q/(128*SL) 1024-byte values
  // G( ZERO(1024),
  //    G( ZERO(1024), Z || LE64(1) || ZERO(968) ) ),
  // ...,
  // G( ZERO(1024),
  //    G( ZERO(1024), Z || LE64(q/(128*SL)) || ZERO(968) )),
  for(let i = 1; i <= segmentLength; i++) {
    // tmp.set(Z); // no need to re-copy
    LE64s(prngTmp, i, Z.length); // tmp.set(ZER0968) not necessary, memory already zeroed
    const g2 = G( ZERO1024, G( ZERO1024, prngTmp, prngR ), prngR );

    // each invocation of G^2 outputs 1024 bytes that are to be partitioned into 8-bytes values, take as X1 || X2
    // NB: the first generated pair must be used for the first block of the segment, and so on.
    // Hence, if some blocks are skipped (e.g. during the first pass), the corresponding J1J2 are discarded based on the given segmentOffset.
    for(let k = i === 1 ? segmentOffset*8 : 0; k < g2.length; k+= 8) {
       yield new Uint32Array([GET32(g2, k), GET32(g2, k + 4)])
    }
  }
  return [];
}

export function getZL(J1, J2, currentLane, p, pass, slice, segmentOffset, SL, segmentLength) {
  // For the first pass (r=0) and the first slice (sl=0), the block is taken from the current lane.
  const l = (pass === 0 && slice === 0) ? currentLane : J2 % p;

  // W includes the indices of all blocks in the last SL - 1 = 3 segments computed and finished (possibly from previous pass, if any).
  // Plus, if `l` is on the current lane, we can also reference the finished blocks in the current segment (up to 'offset')
  const offset = l === currentLane
    ? segmentOffset - 1
    : segmentOffset === 0 ? -1 : 0; // If B[i][j] is the first block of a segment, then the very last index from W is excluded.
  const segmentCount = pass === 0 ? slice : SL-1;
  const W_area  = segmentCount * segmentLength + offset;
  const x = (BigInt(J1) * BigInt(J1)) >> BigInt(32);
  const y = (BigInt(W_area) * x) >> BigInt(32);
  const zz = W_area - 1 - Number(y);
  const startPos = pass === 0 ? 0 : (slice + 1) * segmentLength; // next segment (except for first pass)
  // TODO optimisation: zz < 2 * (SL * segmentLength) so we can use an if instead of %
  const z = (startPos + zz) % (SL * segmentLength);
  return [l, z]
}
export default async function argon2id(settings) {
  const ctx = { type: TYPE, version: VERSION, outlen: 32, ...settings };
  const wasmModule = await WebAssembly.instantiate(wasmBuffer, {});
  const {G:wasmG_, memory} = wasmModule.instance.exports;
  wasmG=wasmG_;
  let offset = 0
  wasmZ = new BigUint64Array(memory.buffer, offset, 128); offset+= wasmZ.length*BigUint64Array.BYTES_PER_ELEMENT;
  const newBlock = new Uint8Array(memory.buffer, offset, ARGON2_BLOCK_SIZE); offset+=newBlock.length;
  // makePRNG vars
  prngR = new Uint8Array(memory.buffer, offset, ARGON2_BLOCK_SIZE); offset+=prngR.length;
  prngTmp = new Uint8Array(memory.buffer, offset, ARGON2_BLOCK_SIZE); offset+=prngTmp.length;
  ZERO1024 = new Uint8Array(memory.buffer, offset, 1024); offset+=ZERO1024.length;
  const blockMemory = new Uint8Array(memory.buffer, offset, ctx.m_cost * ARGON2_BLOCK_SIZE)

  // blockMemory.fill(4)
  // wasmGB=GB; allGB=all;wasmMemory=memory;
  // Create an array that can be passed to the WebAssembly instance.
  // v = new BigUint64Array(wasmMemory.buffer, 0, 16)
  // v32 = new Uint32Array(v.buffer)
    
  // 1. Establish H_0
  const H0 = getH0(ctx);

  // 2. Allocate the memory as m' 1024-byte blocks
  // For p lanes, the memory is organized in a matrix B[i][j] of blocks with p rows (lanes) and q = m' / p columns.
  const m_ = 4 * ctx.lanes * Math.floor(ctx.m_cost / (ctx.lanes << 2)); // m'
  const q = m_ / ctx.lanes;
  const B = new Array(ctx.lanes).fill(null).map(() => new Array(q));
  const initBlock = (i, j) => {
    B[i][j] = blockMemory.subarray(i*q*1024 + j*1024, (i*q*1024 + j*1024) + ARGON2_BLOCK_SIZE);
    return B[i][j];
  }

  // const LE0 = LE32(0);
  // const LE1 = LE32(1);
  for (let i = 0; i < ctx.lanes; i++) {
    // const LEi = LE0; //  since p = 1 for us
    const tmp = new Uint8Array(H0.length + 8);
    // 3. Compute B[i][0] for all i ranging from (and including) 0 to (not including) p
    // B[i][0] = H'^(1024)(H_0 || LE32(0) || LE32(i))
    tmp.set(H0); LE32s(tmp, 0, H0.length); LE32s(tmp, i, H0.length + 4); 
    H_(ARGON2_BLOCK_SIZE, tmp, initBlock(i, 0));
    // 4. Compute B[i][1] for all i ranging from (and including) 0 to (not including) p
    // B[i][1] = H'^(1024)(H_0 || LE32(1) || LE32(i))
    LE32s(tmp, 1, H0.length);
    H_(ARGON2_BLOCK_SIZE, tmp, initBlock(i, 1));
  }

    // 5. Compute B[i][j] for all i ranging from (and including) 0 to (not including) p and for all j ranging from (and including) 2
    // to (not including) q. The computation MUST proceed slicewise (Section 3.4) : first, blocks from slice 0 are computed for all lanes
    // (in an arbitrary order of lanes), then blocks from slice 1 are computed, etc.
  const SL = 4; // vertical slices
  const segmentLength = q / SL;
  for (let pass = 0; pass < ctx.passes; pass++) {
      // The intersection of a slice and a lane is called a segment, which has a length of q/SL. Segments of the same slice can be computed in parallel
    for (let sl = 0; sl < SL; sl++) {
      const isDataIndependent = pass === 0 && sl <= 1;
      for (let i = 0; i < ctx.lanes; i++) { // lane
        // On the first slice of the first pass, blocks 0 and 1 are already filled
        let segmentOffset = sl === 0 && pass === 0 ? 2 : 0;
        // no need to generate all J1J2s, use iterator/generator that creates the value on the fly (to save memory)
        const PRNG = isDataIndependent ? makePRNG(pass, i, sl, m_, ctx.passes, segmentLength, segmentOffset) : null;
        for (segmentOffset; segmentOffset < segmentLength; segmentOffset++) { // TODO this should only go thru the segment, not the whole lane
          const j = sl * segmentLength + segmentOffset;
          const prevBlock = j > 0 ? B[i][j-1] : B[i][q-1]; // B[i][(j-1) mod q]

          // we can assume the PRNG is never done
          const [J1, J2] = isDataIndependent ? PRNG.next().value : new Uint32Array([GET32(prevBlock, 0), GET32(prevBlock, 4)]);
          // The block indices l and z are determined for each i, j differently for Argon2d, Argon2i, and Argon2id.
          const [l, z] = getZL(J1, J2, i, ctx.lanes, pass, sl, segmentOffset, SL, segmentLength)
          // for (let i = 0; i < p; i++ )
          // B[i][j] = G(B[i][j-1], B[l][z])
          // The block indices l and z are determined for each i, j differently for Argon2d, Argon2i, and Argon2id.
          if (pass === 0) initBlock(i, j);
          G(prevBlock, B[l][z],  pass > 0 ? newBlock : B[i][j]);
          // console.log('l' , B[l][z].length, newBlock.length)
          // 6. If the number of passes t is larger than 1, we repeat step 5. However, blocks are computed differently as the old value is XORed with the new one
          if (pass > 0) XOR(B[i][j], newBlock, B[i][j])
          // B[i][j] = newNewBlock;
        }
      }
    }
  }

  // 7. After t steps have been iterated, the final block C is computed as the XOR of the last column:
  // C = B[0][q-1] XOR B[1][q-1] XOR ... XOR B[p-1][q-1]
  const C = B[0][q-1];
  for(let i = 1; i < ctx.lanes; i++) {
    XOR(C, C, B[i][q-1])
  }
  // 8. The output tag is computed as H'^T(C).
  return H_(ctx.outlen, C, new Uint8Array(ctx.outlen));

}

function getH0(ctx) {
  const H = blake2b(ARGON2_PREHASH_DIGEST_LENGTH);
  const ZERO32 = new Uint8Array(4);
  let tmp = new Uint8Array(24);
  LE32s(tmp, ctx.lanes, 0);
  LE32s(tmp, ctx.outlen, 4);
  LE32s(tmp, ctx.m_cost, 8);
  LE32s(tmp, ctx.passes, 12);
  LE32s(tmp, ctx.version, 16);
  LE32s(tmp, ctx.type, 20);
  H.update(tmp);

  tmp = tmp.subarray(0, 4); // reuse to store 32-bit values below
  if (ctx.pwd) {
    H.update(LE32s(tmp, ctx.pwd.length, 0));
    H.update(ctx.pwd)
    // TODO clear pwd?
  } else {
    H.update(ZERO32) // context.pwd.length
  }

  if (ctx.salt) {
    H.update(LE32s(tmp, ctx.salt.length, 0))
    H.update(ctx.salt)
  } else {
    H.update(ZERO32) // context.salt.length
  }

  if (ctx.secret) {
    H.update(LE32s(tmp, ctx.secret.length, 0))
    H.update(ctx.secret)
    // todo clear secret?
  } else {
    H.update(ZERO32) // context.secret.length
  }

  if (ctx.ad) {
    H.update(LE32s(tmp, ctx.ad.length, 0))
    H.update(ctx.ad)
  } else {
    H.update(ZERO32) // context.ad.length
  }

  const outputBuffer = H.digest();
  return new Uint8Array(outputBuffer);
}




export function uint8ArrayToHex(bytes) {
  const res = new Array();
  for (let c = 0; c < bytes.length; c++) {
      const hex = bytes[c].toString(16);
      res.push(hex.length < 2 ? '0' + hex : hex);
  }
  return res.join('');
};