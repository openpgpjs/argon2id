// Adapted from the reference implementation in RFC7693
// Initial port to Javascript by https://github.com/dcposch and https://github.com/emilbayes

// Uint64 values are represented using two Uint32s, stored as little endian
// NB: Uint32Arrays endianness depends on the underlying system, so for interoperability, conversions between Uint8Array and Uint32Arrays
// need to be manually handled

// 64-bit unsigned addition (little endian, in place)
// Sets a[i,i+1] += b[j,j+1]
// `a` and `b` must be Uint32Array(2)
function ADD64 (a, i, b, j) {
  a[i] += b[j];
  a[i+1] += b[j+1] + (a[i] < b[j]); // add carry
}

// Increment 64-bit little-endian unsigned value by `c` (in place)
// `a` must be Uint32Array(2)
function INC64 (a, c) {
  a[0] += c;
  a[1] += (a[0] < c);
}

// G Mixing function
// The ROTRs are inlined for speed
function G (v, m, a, b, c, d, ix, iy) {
  ADD64(v, a, v, b) // v[a,a+1] += v[b,b+1]
  ADD64(v, a, m, ix) // v[a, a+1] += x ... x0

  // v[d,d+1] = (v[d,d+1] xor v[a,a+1]) rotated to the right by 32 bits
  let xor0 = v[d] ^ v[a]
  let xor1 = v[d + 1] ^ v[a + 1]
  v[d] = xor1
  v[d + 1] = xor0

  ADD64(v, c, v, d)

  // v[b,b+1] = (v[b,b+1] xor v[c,c+1]) rotated right by 24 bits
  xor0 = v[b] ^ v[c]
  xor1 = v[b + 1] ^ v[c + 1]
  v[b] = (xor0 >>> 24) ^ (xor1 << 8)
  v[b + 1] = (xor1 >>> 24) ^ (xor0 << 8)

  ADD64(v, a, v, b)
  ADD64(v, a, m, iy)

  // v[d,d+1] = (v[d,d+1] xor v[a,a+1]) rotated right by 16 bits
  xor0 = v[d] ^ v[a]
  xor1 = v[d + 1] ^ v[a + 1]
  v[d] = (xor0 >>> 16) ^ (xor1 << 16)
  v[d + 1] = (xor1 >>> 16) ^ (xor0 << 16)

  ADD64(v, c, v, d)

  // v[b,b+1] = (v[b,b+1] xor v[c,c+1]) rotated right by 63 bits
  xor0 = v[b] ^ v[c]
  xor1 = v[b + 1] ^ v[c + 1]
  v[b] = (xor1 >>> 31) ^ (xor0 << 1)
  v[b + 1] = (xor0 >>> 31) ^ (xor1 << 1)
}

// Initialization Vector
const BLAKE2B_IV32 = new Uint32Array([
  0xF3BCC908, 0x6A09E667, 0x84CAA73B, 0xBB67AE85,
  0xFE94F82B, 0x3C6EF372, 0x5F1D36F1, 0xA54FF53A,
  0xADE682D1, 0x510E527F, 0x2B3E6C1F, 0x9B05688C,
  0xFB41BD6B, 0x1F83D9AB, 0x137E2179, 0x5BE0CD19
])

// These are offsets into a Uint64 buffer.
// Multiply them all by 2 to make them offsets into a Uint32 buffer
const SIGMA = new Uint8Array([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3,
  11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4,
  7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8,
  9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13,
  2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9,
  12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11,
  13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10,
  6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5,
  10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0,
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3
].map(x => x * 2))

// Compression function. 'last' flag indicates last block.
// Note: we're representing 16 uint64s as 32 uint32s
function compress(S, last) {
  const v = new Uint32Array(32)
  const m = new Uint32Array(S.b.buffer, S.b.byteOffset, 32)

  // init work variables
  for (let i = 0; i < 16; i++) {
    v[i] = S.h[i]
    v[i + 16] = BLAKE2B_IV32[i]
  }

  // low 64 bits of offset
  v[24] ^= S.t0[0]
  v[25] ^= S.t0[1]
  // high 64 bits not supported (`t1`), offset may not be higher than 2**53-1

  // if last block
  const f0 = last ? 0xFFFFFFFF : 0;
  v[28] ^= f0;
  v[29] ^= f0;

  // twelve rounds of mixing
  for (let i = 0; i < 12; i++) {
    // ROUND(r)
    const i16 = i << 4;
    G(v, m, 0, 8, 16, 24,  SIGMA[i16 + 0], SIGMA[i16 + 1])
    G(v, m, 2, 10, 18, 26, SIGMA[i16 + 2], SIGMA[i16 + 3])
    G(v, m, 4, 12, 20, 28, SIGMA[i16 + 4], SIGMA[i16 + 5])
    G(v, m, 6, 14, 22, 30, SIGMA[i16 + 6], SIGMA[i16 + 7])
    G(v, m, 0, 10, 20, 30, SIGMA[i16 + 8], SIGMA[i16 + 9])
    G(v, m, 2, 12, 22, 24, SIGMA[i16 + 10], SIGMA[i16 + 11])
    G(v, m, 4, 14, 16, 26, SIGMA[i16 + 12], SIGMA[i16 + 13])
    G(v, m, 6, 8, 18, 28,  SIGMA[i16 + 14], SIGMA[i16 + 15])
  }

  for (let i = 0; i < 16; i++) {
    S.h[i] ^= v[i] ^ v[i + 16]
  }
}

// Creates a BLAKE2b hashing context
// Requires an output length between 1 and 64 bytes
// Takes an optional Uint8Array key
class Blake2b {
  constructor(outlen, key, salt, personal) {
    const params = new Uint8Array(64)
    //  0: outlen, keylen, fanout, depth
    //  4: leaf length, sequential mode
    //  8: node offset
    // 12: node offset
    // 16: node depth, inner length, rfu
    // 20: rfu
    // 24: rfu
    // 28: rfu
    // 32: salt
    // 36: salt
    // 40: salt
    // 44: salt
    // 48: personal
    // 52: personal
    // 56: personal
    // 60: personal

    // init internal state
    this.S = {
      b: new Uint8Array(BLOCKBYTES),
      h: new Uint32Array(OUTBYTES_MAX / 4),
      t0: new Uint32Array(2), // input counter `t`, lower 64-bits only
      c: 0, // `fill`, pointer within buffer, up to `BLOCKBYTES`
      outlen // output length in bytes
    }

    // init parameter block
    params[0] = outlen
    if (key) params[1] = key.length
    params[2] = 1 // fanout
    params[3] = 1 // depth
    if (salt) params.set(salt, 32)
    if (personal) params.set(personal, 48)
    const params32 = new Uint32Array(params.buffer, params.byteOffset, params.length / Uint32Array.BYTES_PER_ELEMENT);

    // initialize hash state
    for (let i = 0; i < 16; i++) {
      this.S.h[i] = BLAKE2B_IV32[i] ^ params32[i];
    }

    // key the hash, if applicable
    if (key) {
      const block = new Uint8Array(BLOCKBYTES)
      block.set(key)
      this.update(block)
    }
  }

  // Updates a BLAKE2b streaming hash
  // Requires Uint8Array (byte array)
  update(input) {
    if (!(input instanceof Uint8Array)) throw new Error('Input must be Uint8Array or Buffer')
    // for (let i = 0; i < input.length; i++) {
    //   if (this.S.c === BLOCKBYTES) { // buffer full
    //     INC64(this.S.t0, this.S.c) // add counters
    //     compress(this.S, false)
    //     this.S.c = 0 // empty buffer
    //   }
    //   this.S.b[this.S.c++] = input[i]
    // }
    let i = 0
    while(i < input.length) {
      if (this.S.c === BLOCKBYTES) { // buffer full
        INC64(this.S.t0, this.S.c) // add counters
        compress(this.S, false)
        this.S.c = 0 // empty buffer
      }
      let left = BLOCKBYTES - this.S.c
      this.S.b.set(input.subarray(i, i + left), this.S.c) // end index can be out of bounds
      const fill = Math.min(left, input.length - i)
      this.S.c += fill
      i += fill
    }
    return this
  }

  /**
   * Return a BLAKE2b hash, either filling the given Uint8Array or allocating a new one
   * @param {Uint8Array} [prealloc] - optional preallocated buffer
   * @returns {ArrayBuffer} message digest
   */
  digest(prealloc) {
    INC64(this.S.t0, this.S.c) // mark last block offset

    // final block, padded
    this.S.b.fill(0, this.S.c);
    this.S.c = BLOCKBYTES;
    compress(this.S, true)

    const out = prealloc || new Uint8Array(this.S.outlen);
    for (let i = 0; i < this.S.outlen; i++) {
      // must be loaded individually since default Uint32 endianness is platform dependant
      out[i] = this.S.h[i >> 2] >> (8 * (i & 3))
    }
    this.S.h = null; // prevent calling `update` after `digest`
    return out.buffer;
  }
}


export default function createHash(outlen, key, salt, personal) {
  if (outlen > OUTBYTES_MAX) throw new Error(`outlen must be at most ${OUTBYTES_MAX} (given: ${outlen})`)
  if (key) {
    if (!(key instanceof Uint8Array)) throw new Error('key must be Uint8Array or Buffer')
    if (key.length > KEYBYTES_MAX) throw new Error(`key size must be at most ${KEYBYTES_MAX} (given: ${key.length})`)
  }
  if (salt) {
    if (!(salt instanceof Uint8Array)) throw new Error('salt must be Uint8Array or Buffer')
    if (salt.length !== SALTBYTES) throw new Error(`salt must be exactly ${SALTBYTES} (given: ${salt.length}`)
  }
  if (personal) {
    if (!(personal instanceof Uint8Array)) throw new Error('personal must be Uint8Array or Buffer')
    if (personal.length !== PERSONALBYTES) throw new Error(`salt must be exactly ${PERSONALBYTES} (given: ${personal.length}`)
  }

  return new Blake2b(outlen, key, salt, personal)
}

const OUTBYTES_MAX = 64;
const KEYBYTES_MAX = 64;
const SALTBYTES = 16;
const PERSONALBYTES = 16;
const BLOCKBYTES = 128;

