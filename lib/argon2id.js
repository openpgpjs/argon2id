import blake2b from "./blake2b.js"
const TYPE = 2;  // Argon2id
const VERSION = 0x13;
const TAGBYTES_MAX = 0xFFFFFFFF; // Math.pow(2, 32) - 1;
const TAGBYTES_MIN = 4; // Math.pow(2, 32) - 1;
const SALTBYTES_MAX = 0xFFFFFFFF; // Math.pow(2, 32) - 1;
const SALTBYTES_MIN = 8;
const passwordBYTES_MAX = 0xFFFFFFFF;// Math.pow(2, 32) - 1;
const passwordBYTES_MIN = 8;
const MEMBYTES_MAX = 0xFFFFFFFF;// Math.pow(2, 32) - 1;
const ADBYTES_MAX = 0xFFFFFFFF; // Math.pow(2, 32) - 1; // associated data (optional)
const SECRETBYTES_MAX = 32; // key (optional)

const ARGON2_BLOCK_SIZE = 1024;
const ARGON2_PREHASH_DIGEST_LENGTH = 64;

const isLittleEndian = new Uint8Array(new Uint16Array([0xabcd]).buffer)[0] === 0xcd;

// store n as a little-endian 32-bit Uint8Array inside buf (at buf[i:i+3])
function LE32(buf, n, i) {
  buf[i+0] = n;
  buf[i+1] = n >>  8;
  buf[i+2] = n >> 16;
  buf[i+3] = n >> 24;
  return buf;
}

/**
 * Store n as a 64-bit LE number in the given buffer (from buf[i] to buf[i+7])
 * @param {Uint8Array} buf
 * @param {Number} n
 * @param {Number} i
 */
function LE64(buf, n, i) {
  if (n > Number.MAX_SAFE_INTEGER) throw new Error("LE64: large numbers unsupported");
  // ECMAScript standard has engines convert numbers to 32-bit integers for bitwise operations
  // shifting by 32 or more bits is not supported (https://stackoverflow.com/questions/6729122/javascript-bit-shift-number-wraps)
  // so we manually extract each byte
  let remainder = n;
  for (let offset = i; offset < i+7; offset++) { // last byte can be ignored as it would overflow MAX_SAFE_INTEGER
    buf[offset] = remainder; // implicit & 0xff
    remainder = (remainder - buf[offset]) / 256;
  }
  return buf;
}

/**
 * Variable-Length Hash Function H'
 * @param {Number} outlen - T
 * @param {Uint8Array} X - value to hash
 * @param {Uint8Array} res - output buffer, of length `outlength` or larger
 */
function H_(outlen, X, res) {
  const V = new Uint8Array(64); // no need to keep around all V_i

  const V1_in = new Uint8Array(4 + X.length);
  LE32(V1_in, outlen, 0);
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
    blake2b(64).update(i === 0 ? V1_in : V).digest(V);
    // store W_i in result buffer already
    res.set(V.subarray(0, 32), i*32)
  }
  // V_{r+1}
  const V_r1 = new Uint8Array(blake2b(outlen - 32*r).update(V).digest());
  res.set(V_r1, r*32);

  return res;
}

// compute buf = xs ^ ys
function XOR(wasmContext, buf, xs, ys) {
  wasmContext.fn.XOR(
    buf.byteOffset,
    xs.byteOffset,
    ys.byteOffset,
  );
  return buf
}

/**
 * @param {Uint8Array} X (read-only)
 * @param {Uint8Array} Y (read-only)
 * @param {Uint8Array} R - output buffer
 * @returns
 */
function G(wasmContext, X, Y, R) {
  wasmContext.fn.G(
    X.byteOffset,
    Y.byteOffset,
    R.byteOffset,
    wasmContext.refs.gZ.byteOffset
  );
  return R;
}

function G2(wasmContext, X, Y, R) {
  wasmContext.fn.G2(
    X.byteOffset,
    Y.byteOffset,
    R.byteOffset,
    wasmContext.refs.gZ.byteOffset
  );
  return R;
}

// Generator for data-independent J1, J2. Each `next()` invocation returns a new pair of values.
function* makePRNG(wasmContext, pass, lane, slice, m_, totalPasses, segmentLength, segmentOffset) {
  // For each segment, we do the following. First, we compute the value Z as:
  // Z= ( LE64(r) || LE64(l) || LE64(sl) || LE64(m') || LE64(t) || LE64(y) )
  wasmContext.refs.prngTmp.fill(0);
  const Z = wasmContext.refs.prngTmp.subarray(0, 6 * 8);
  LE64(Z, pass, 0);
  LE64(Z, lane, 8);
  LE64(Z, slice, 16);
  LE64(Z, m_, 24);
  LE64(Z, totalPasses, 32);
  LE64(Z, TYPE, 40);

  // Then we compute q/(128*SL) 1024-byte values
  // G( ZERO(1024),
  //    G( ZERO(1024), Z || LE64(1) || ZERO(968) ) ),
  // ...,
  // G( ZERO(1024),
  //    G( ZERO(1024), Z || LE64(q/(128*SL)) || ZERO(968) )),
  for(let i = 1; i <= segmentLength; i++) {
    // tmp.set(Z); // no need to re-copy
    LE64(wasmContext.refs.prngTmp, i, Z.length); // tmp.set(ZER0968) not necessary, memory already zeroed
    const g2 = G2(wasmContext, wasmContext.refs.ZERO1024, wasmContext.refs.prngTmp, wasmContext.refs.prngR );

    // each invocation of G^2 outputs 1024 bytes that are to be partitioned into 8-bytes values, take as X1 || X2
    // NB: the first generated pair must be used for the first block of the segment, and so on.
    // Hence, if some blocks are skipped (e.g. during the first pass), the corresponding J1J2 are discarded based on the given segmentOffset.
    for(let k = i === 1 ? segmentOffset*8 : 0; k < g2.length; k += 8) {
       yield g2.subarray(k, k+8);
    }
  }
  return [];
}

function validateParams({ type, version, tagLength, password, salt, ad, secret, parallelism, memorySize, passes }) {
  const assertLength = (name, value, min, max) => {
    if (value < min || value > max) { throw new Error(`${name} size should be between ${min} and ${max} bytes`); }
  }

  if (type !== TYPE || version !== VERSION) throw new Error('Unsupported type or version');
  assertLength('password', password, passwordBYTES_MIN, passwordBYTES_MAX);
  assertLength('salt', salt, SALTBYTES_MIN, SALTBYTES_MAX);
  assertLength('tag', tagLength, TAGBYTES_MIN, TAGBYTES_MAX);
  assertLength('memory', memorySize, 8*parallelism, MEMBYTES_MAX);
  // optional fields
  ad && assertLength('associated data', ad, 0, ADBYTES_MAX);
  secret && assertLength('secret', secret, 0, SECRETBYTES_MAX);

  return { type, version, tagLength, password, salt, ad, secret, lanes: parallelism, memorySize, passes };
}

const KB = 1024;
const WASM_PAGE_SIZE = 64 * KB;

export default function argon2id(params, { memory, instance: wasmInstance }) {
  if (!isLittleEndian) throw new Error('BigEndian system not supported'); // optmisations assume LE system

  const ctx = validateParams({ type: TYPE, version: VERSION, ...params });

  const { G:wasmG, G2:wasmG2, xor:wasmXOR, getLZ:wasmLZ } = wasmInstance.exports;
  const wasmRefs = {};
  const wasmFn = {};
  wasmFn.G = wasmG;
  wasmFn.G2 = wasmG2;
  wasmFn.XOR = wasmXOR;

  // The actual number of blocks is m', which is m rounded down to the nearest multiple of 4*p.
  const m_ = 4 * ctx.lanes * Math.floor(ctx.memorySize / (4 * ctx.lanes));
  const requiredMemory = m_ * ARGON2_BLOCK_SIZE + 10 * KB; // Additional KBs for utility references
  if (memory.buffer.byteLength < requiredMemory) {
    const missing = Math.ceil((requiredMemory - memory.buffer.byteLength) / WASM_PAGE_SIZE)
    // If enough memory is available, the `memory.buffer` is internally detached and the reference updated.
    // Otherwise, the operation fails, and the original memory can still be used.
    memory.grow(missing)
  }

  let offset = 0;
  // Init wasm memory needed in other functions
  wasmRefs.gZ = new Uint8Array(memory.buffer, offset, ARGON2_BLOCK_SIZE); offset+= wasmRefs.gZ.length;
  wasmRefs.prngR = new Uint8Array(memory.buffer, offset, ARGON2_BLOCK_SIZE); offset+=wasmRefs.prngR.length;
  wasmRefs.prngTmp = new Uint8Array(memory.buffer, offset, ARGON2_BLOCK_SIZE); offset+=wasmRefs.prngTmp.length;
  wasmRefs.ZERO1024 = new Uint8Array(memory.buffer, offset, 1024); offset+=wasmRefs.ZERO1024.length;
  // Init wasm memory needed locally
  const lz = new Uint32Array(memory.buffer, offset, 2); offset+=lz.length * Uint32Array.BYTES_PER_ELEMENT;
  const wasmContext = { fn: wasmFn, refs: wasmRefs };
  const newBlock = new Uint8Array(memory.buffer, offset, ARGON2_BLOCK_SIZE); offset+=newBlock.length;
  const blockMemory = new Uint8Array(memory.buffer, offset, ctx.memorySize * ARGON2_BLOCK_SIZE);
  const allocatedMemory = new Uint8Array(memory.buffer, 0, offset);

  // 1. Establish H_0
  const H0 = getH0(ctx);

  // 2. Allocate the memory as m' 1024-byte blocks
  // For p lanes, the memory is organized in a matrix B[i][j] of blocks with p rows (lanes) and q = m' / p columns.
  const q = m_ / ctx.lanes;
  const B = new Array(ctx.lanes).fill(null).map(() => new Array(q));
  const initBlock = (i, j) => {
    B[i][j] = blockMemory.subarray(i*q*1024 + j*1024, (i*q*1024 + j*1024) + ARGON2_BLOCK_SIZE);
    return B[i][j];
  }

  for (let i = 0; i < ctx.lanes; i++) {
    // const LEi = LE0; //  since p = 1 for us
    const tmp = new Uint8Array(H0.length + 8);
    // 3. Compute B[i][0] for all i ranging from (and including) 0 to (not including) p
    // B[i][0] = H'^(1024)(H_0 || LE32(0) || LE32(i))
    tmp.set(H0); LE32(tmp, 0, H0.length); LE32(tmp, i, H0.length + 4);
    H_(ARGON2_BLOCK_SIZE, tmp, initBlock(i, 0));
    // 4. Compute B[i][1] for all i ranging from (and including) 0 to (not including) p
    // B[i][1] = H'^(1024)(H_0 || LE32(1) || LE32(i))
    LE32(tmp, 1, H0.length);
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
        const PRNG = isDataIndependent ? makePRNG(wasmContext, pass, i, sl, m_, ctx.passes, segmentLength, segmentOffset) : null;
        for (segmentOffset; segmentOffset < segmentLength; segmentOffset++) {
          const j = sl * segmentLength + segmentOffset;
          const prevBlock = j > 0 ? B[i][j-1] : B[i][q-1]; // B[i][(j-1) mod q]

          // we can assume the PRNG is never done
          const J1J2 = isDataIndependent ? PRNG.next().value : prevBlock; // .subarray(0, 8) not required since we only pass the byteOffset to wasm
          // The block indices l and z are determined for each i, j differently for Argon2d, Argon2i, and Argon2id.
          wasmLZ(lz.byteOffset, J1J2.byteOffset, i, ctx.lanes, pass, sl, segmentOffset, SL, segmentLength)
          const l = lz[0]; const z = lz[1];
          // for (let i = 0; i < p; i++ )
          // B[i][j] = G(B[i][j-1], B[l][z])
          // The block indices l and z are determined for each i, j differently for Argon2d, Argon2i, and Argon2id.
          if (pass === 0) initBlock(i, j);
          G(wasmContext, prevBlock, B[l][z], pass > 0 ? newBlock : B[i][j]);

          // 6. If the number of passes t is larger than 1, we repeat step 5. However, blocks are computed differently as the old value is XORed with the new one
          if (pass > 0) XOR(wasmContext, B[i][j], newBlock, B[i][j])
        }
      }
    }
  }

  // 7. After t steps have been iterated, the final block C is computed as the XOR of the last column:
  // C = B[0][q-1] XOR B[1][q-1] XOR ... XOR B[p-1][q-1]
  const C = B[0][q-1];
  for(let i = 1; i < ctx.lanes; i++) {
    XOR(wasmContext, C, C, B[i][q-1])
  }

  const tag = H_(ctx.tagLength, C, new Uint8Array(ctx.tagLength));
  // clear memory since the module might be cached
  allocatedMemory.fill(0) // clear sensitive contents
  memory.grow(0) // allow deallocation
  // 8. The output tag is computed as H'^T(C).
  return tag;

}

function getH0(ctx) {
  const H = blake2b(ARGON2_PREHASH_DIGEST_LENGTH);
  const ZERO32 = new Uint8Array(4);
  const params = new Uint8Array(24);
  LE32(params, ctx.lanes, 0);
  LE32(params, ctx.tagLength, 4);
  LE32(params, ctx.memorySize, 8);
  LE32(params, ctx.passes, 12);
  LE32(params, ctx.version, 16);
  LE32(params, ctx.type, 20);

  const toHash = [params];
  if (ctx.password) {
    toHash.push(LE32(new Uint8Array(4), ctx.password.length, 0))
    toHash.push(ctx.password)
  } else {
    toHash.push(ZERO32) // context.password.length
  }

  if (ctx.salt) {
    toHash.push(LE32(new Uint8Array(4), ctx.salt.length, 0))
    toHash.push(ctx.salt)
  } else {
    toHash.push(ZERO32) // context.salt.length
  }

  if (ctx.secret) {
    toHash.push(LE32(new Uint8Array(4), ctx.secret.length, 0))
    toHash.push(ctx.secret)
    // todo clear secret?
  } else {
    toHash.push(ZERO32) // context.secret.length
  }

  if (ctx.ad) {
    toHash.push(LE32(new Uint8Array(4), ctx.ad.length, 0))
    toHash.push(ctx.ad)
  } else {
    toHash.push(ZERO32) // context.ad.length
  }
  H.update(concatArrays(toHash))

  const outputBuffer = H.digest();
  return new Uint8Array(outputBuffer);
}

function concatArrays(arrays) {
  if (arrays.length === 1) return arrays[0];

  let totalLength = 0;
  for (let i = 0; i < arrays.length; i++) {
      if (!(arrays[i] instanceof Uint8Array)) {
          throw new Error('concatArrays: Data must be in the form of a Uint8Array');
      }

      totalLength += arrays[i].length;
  }

  const result = new Uint8Array(totalLength);
  let pos = 0;
  arrays.forEach((element) => {
      result.set(element, pos);
      pos += element.length;
  });

  return result;
}
