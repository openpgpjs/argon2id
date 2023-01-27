/**
 * Vectorised code mostly taken from: Argon2 reference C implementations (www.github.com/P-H-C/phc-winner-argon2)
 * Copyright 2015 Daniel Dinu, Dmitry Khovratovich, Jean-Philippe Aumasson, and Samuel Neves
 * Licence: CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0)
 */
#include <stdint.h>
// #include <stdio.h>
#undef EMSCRIPTEN_KEEPALIVE
#define EMSCRIPTEN_KEEPALIVE __attribute__((used)) __attribute__((retain))

#if defined(__SSSE3__) || defined(__SSE2__)
#include <emmintrin.h>

#if defined(__SSSE3__)
#include <tmmintrin.h>
  #define r16                                                                    \
      (_mm_setr_epi8(2, 3, 4, 5, 6, 7, 0, 1, 10, 11, 12, 13, 14, 15, 8, 9))
  #define r24                                                                    \
      (_mm_setr_epi8(3, 4, 5, 6, 7, 0, 1, 2, 11, 12, 13, 14, 15, 8, 9, 10))
  #define _mm_roti_epi64(x, c)                                                   \
      (-(c) == 32)                                                               \
          ? _mm_shuffle_epi32((x), _MM_SHUFFLE(2, 3, 0, 1))                      \
          : (-(c) == 24)                                                         \
                ? _mm_shuffle_epi8((x), r24)                                     \
                : (-(c) == 16)                                                   \
                      ? _mm_shuffle_epi8((x), r16)                               \
                      : (-(c) == 63)                                             \
                            ? _mm_xor_si128(_mm_srli_epi64((x), -(c)),           \
                                            _mm_add_epi64((x), (x)))             \
                            : _mm_xor_si128(_mm_srli_epi64((x), -(c)),           \
                                            _mm_slli_epi64((x), 64 - (-(c))))
#else /* SSE2 */
  #define _mm_roti_epi64(r, c)                                                   \
      _mm_xor_si128(_mm_srli_epi64((r), -(c)), _mm_slli_epi64((r), 64 - (-(c))))
#endif
static __m128i fBlaMka(__m128i x, __m128i y) {
    const __m128i z = _mm_mul_epu32(x, y);
    return _mm_add_epi64(_mm_add_epi64(x, y), _mm_add_epi64(z, z));
}

#define GB1(A0, B0, C0, D0, A1, B1, C1, D1)                                \
  do {                                                                     \
    A0 = fBlaMka(A0, B0);                                                  \
    A1 = fBlaMka(A1, B1);                                                  \
                                                                           \
    D0 = _mm_xor_si128(D0, A0);                                            \
    D1 = _mm_xor_si128(D1, A1);                                            \
                                                                           \
    D0 = _mm_roti_epi64(D0, -32);                                          \
    D1 = _mm_roti_epi64(D1, -32);                                          \
                                                                           \
    C0 = fBlaMka(C0, D0);                                                  \
    C1 = fBlaMka(C1, D1);                                                  \
                                                                           \
    B0 = _mm_xor_si128(B0, C0);                                            \
    B1 = _mm_xor_si128(B1, C1);                                            \
                                                                           \
    B0 = _mm_roti_epi64(B0, -24);                                          \
    B1 = _mm_roti_epi64(B1, -24);                                          \
  } while ((void)0, 0) 

#define GB2(A0, B0, C0, D0, A1, B1, C1, D1)                                \
  do {                                                                     \
    A0 = fBlaMka(A0, B0);                                                  \
    A1 = fBlaMka(A1, B1);                                                  \
                                                                           \
    D0 = _mm_xor_si128(D0, A0);                                            \
    D1 = _mm_xor_si128(D1, A1);                                            \
                                                                           \
    D0 = _mm_roti_epi64(D0, -16);                                          \
    D1 = _mm_roti_epi64(D1, -16);                                          \
                                                                           \
    C0 = fBlaMka(C0, D0);                                                  \
    C1 = fBlaMka(C1, D1);                                                  \
                                                                           \
    B0 = _mm_xor_si128(B0, C0);                                            \
    B1 = _mm_xor_si128(B1, C1);                                            \
                                                                           \
    B0 = _mm_roti_epi64(B0, -63);                                          \
    B1 = _mm_roti_epi64(B1, -63);                                          \
  } while ((void)0, 0)

#if defined(__SSSE3__)
  #define DIAGONALIZE(A0, B0, C0, D0, A1, B1, C1, D1)                            \
      do {                                                                       \
          __m128i t0 = _mm_alignr_epi8(B1, B0, 8);                               \
          __m128i t1 = _mm_alignr_epi8(B0, B1, 8);                               \
          B0 = t0;                                                               \
          B1 = t1;                                                               \
                                                                                \
          t0 = C0;                                                               \
          C0 = C1;                                                               \
          C1 = t0;                                                               \
                                                                                \
          t0 = _mm_alignr_epi8(D1, D0, 8);                                       \
          t1 = _mm_alignr_epi8(D0, D1, 8);                                       \
          D0 = t1;                                                               \
          D1 = t0;                                                               \
      } while ((void)0, 0)

  #define UNDIAGONALIZE(A0, B0, C0, D0, A1, B1, C1, D1)                          \
      do {                                                                       \
          __m128i t0 = _mm_alignr_epi8(B0, B1, 8);                               \
          __m128i t1 = _mm_alignr_epi8(B1, B0, 8);                               \
          B0 = t0;                                                               \
          B1 = t1;                                                               \
                                                                                \
          t0 = C0;                                                               \
          C0 = C1;                                                               \
          C1 = t0;                                                               \
                                                                                \
          t0 = _mm_alignr_epi8(D0, D1, 8);                                       \
          t1 = _mm_alignr_epi8(D1, D0, 8);                                       \
          D0 = t1;                                                               \
          D1 = t0;                                                               \
      } while ((void)0, 0)
#else /* SSE2 */
  #define DIAGONALIZE(A0, B0, C0, D0, A1, B1, C1, D1)                        \
    do {                                                                     \
      __m128i t0 = D0;                                                       \
      __m128i t1 = B0;                                                       \
      D0 = C0;                                                               \
      C0 = C1;                                                               \
      C1 = D0;                                                               \
      D0 = _mm_unpackhi_epi64(D1, _mm_unpacklo_epi64(t0, t0));               \
      D1 = _mm_unpackhi_epi64(t0, _mm_unpacklo_epi64(D1, D1));               \
      B0 = _mm_unpackhi_epi64(B0, _mm_unpacklo_epi64(B1, B1));               \
      B1 = _mm_unpackhi_epi64(B1, _mm_unpacklo_epi64(t1, t1));               \
    } while ((void)0, 0)

  #define UNDIAGONALIZE(A0, B0, C0, D0, A1, B1, C1, D1)                      \
    do {                                                                     \
      __m128i t0, t1;                                                        \
      t0 = C0;                                                               \
      C0 = C1;                                                               \
      C1 = t0;                                                               \
      t0 = B0;                                                               \
      t1 = D0;                                                               \
      B0 = _mm_unpackhi_epi64(B1, _mm_unpacklo_epi64(B0, B0));               \
      B1 = _mm_unpackhi_epi64(t0, _mm_unpacklo_epi64(B1, B1));               \
      D0 = _mm_unpackhi_epi64(D0, _mm_unpacklo_epi64(D1, D1));               \
      D1 = _mm_unpackhi_epi64(D1, _mm_unpacklo_epi64(t1, t1));               \
    } while ((void)0, 0)
#endif
// BLAKE2_ROUND in reference code
#define P(A0, A1, B0, B1, C0, C1, D0, D1)                                  \
  do {                                                                     \
    GB1(A0, B0, C0, D0, A1, B1, C1, D1);                                   \
    GB2(A0, B0, C0, D0, A1, B1, C1, D1);                                   \
                                                                           \
    DIAGONALIZE(A0, B0, C0, D0, A1, B1, C1, D1);                           \
                                                                           \
    GB1(A0, B0, C0, D0, A1, B1, C1, D1);                                   \
    GB2(A0, B0, C0, D0, A1, B1, C1, D1);                                   \
                                                                           \
    UNDIAGONALIZE(A0, B0, C0, D0, A1, B1, C1, D1);                         \
  } while ((void)0, 0)


EMSCRIPTEN_KEEPALIVE void xor(__m128i* out, __m128i* x, __m128i* y){
  for(uint8_t i = 0; i < 64; i++) { // ARGON2_BLOCK_SIZE (1024) / 16 bytes (128bits) = 64
    out[i] = _mm_xor_si128(x[i], y[i]);
  }
}

// G will be given uint64_t* values by JS, which can be automatically casted to _m128i*:
// see https://stackoverflow.com/questions/11034302/sse-difference-between-mm-load-store-vs-using-direct-pointer-access
EMSCRIPTEN_KEEPALIVE void G(__m128i* X, __m128i* Y, __m128i* R, __m128i* Z) {
    for (uint8_t i = 0; i < 64; i++) { // inlined `xor` to set both R and Z
      R[i] = Z[i] = _mm_xor_si128(X[i], Y[i]);
    }

    for (uint8_t i = 0; i < 8; ++i) {
      P(Z[8 * i + 0], Z[8 * i + 1], Z[8 * i + 2],
        Z[8 * i + 3], Z[8 * i + 4], Z[8 * i + 5],
        Z[8 * i + 6], Z[8 * i + 7]);
    }

    for (uint8_t i = 0; i < 8; ++i) {
      P(Z[8 * 0 + i], Z[8 * 1 + i], Z[8 * 2 + i],
        Z[8 * 3 + i], Z[8 * 4 + i], Z[8 * 5 + i],
        Z[8 * 6 + i], Z[8 * 7 + i]);
    }

    xor(R, R, Z);
}

// G^2
EMSCRIPTEN_KEEPALIVE void G2(__m128i* X, __m128i* Y, __m128i* R, __m128i* Z) {
  G( X, Y, R, Z );
  G( X, R, R, Z );
}

#else // no vectorization

uint64_t rotr64(uint64_t x, uint64_t n) { return (x >> n) ^ (x << (64 - n)); }

#define LSB(x) ((x) & 0xffffffff)
EMSCRIPTEN_KEEPALIVE void xor(uint64_t* out, uint64_t* x, uint64_t* y){for(uint8_t i = 0; i < 128; i++) out[i] = x[i] ^ y[i];}


void GB(uint64_t* v, int a, int b, int c, int d) {

  // a = (a + b + 2 * trunc(a) * trunc(b)) mod 2^(64)
  v[a] += v[b] + 2 * LSB(v[a]) * LSB(v[b]);

  // d = (d XOR a) >>> 32, where >>> is a rotation
  v[d] = rotr64(v[d] ^ v[a], 32);
  // c = (c + d + 2 * trunc(c) * trunc(d)) mod 2^(64)
  v[c] += v[d] + 2 * LSB(v[c]) * LSB(v[d]);

  // b = (b XOR c) >>> 24
  v[b] = rotr64(v[b] ^ v[c], 24);

  // a = (a + b + 2 * trunc(a) * trunc(b)) mod 2^(64)
  v[a] += v[b] + 2 * LSB(v[a]) * LSB(v[b]);


  // d = (d XOR a) >>> 16
  v[d] = rotr64(v[d] ^ v[a], 16);


  // c = (c + d + 2 * trunc(c) * trunc(d)) mod 2^(64)
  v[c] += v[d] + 2 * LSB(v[c]) * LSB(v[d]);



  // b = (b XOR c) >>> 63
  v[b] = rotr64(v[b] ^ v[c], 63);

}

void P(uint64_t* v, uint16_t i0,uint16_t i1,uint16_t i2,uint16_t i3,uint16_t i4,uint16_t i5,uint16_t i6,uint16_t i7, uint16_t i8,uint16_t i9,uint16_t i10,uint16_t i11,uint16_t i12,uint16_t i13,uint16_t i14,uint16_t i15) {
  // v stores 16 64-bit values

  GB(v, i0,  i4, i8, i12);
  GB(v, i1,  i5, i9, i13);
  GB(v, i2, i6, i10, i14);
  GB(v, i3, i7, i11, i15);

  GB(v, i0, i5, i10, i15);
  GB(v, i1, i6, i11, i12);
  GB(v, i2, i7, i8, i13);
  GB(v, i3,  i4, i9, i14);
}
// given a copy of R, compute Z (in-place) 
EMSCRIPTEN_KEEPALIVE void G(uint64_t* X, uint64_t* Y, uint64_t* R, uint64_t* Z) {
  xor(R, X, Y);
  // // we need to store S_i = (v_{2*i+1} || v_{2*i}), for v[i] of 64 bits
  // // S[0] = R[8:15] || R[0:7]
  for(uint8_t i = 0; i < 128; i+=16) {
    Z[i+0] = R[i+0]; Z[i+1] = R[i+1]; Z[i+2] = R[i+2]; Z[i+3] = R[i+3];
    Z[i+4] = R[i+4]; Z[i+5] = R[i+5]; Z[i+6] = R[i+6]; Z[i+7] = R[i+7];
    Z[i+8] = R[i+8]; Z[i+9] = R[i+9]; Z[i+10] = R[i+10]; Z[i+11] = R[i+11];
    Z[i+12] = R[i+12]; Z[i+13] = R[i+13]; Z[i+14] = R[i+14]; Z[i+15] = R[i+15];
    // const ids = [0, 1, 2, 3, 4, 5, 6, 7].map(j => i*128 + j*16); // 0, 16, .. 112 | 128, 144...
    // ( Q_0,  Q_1,  Q_2, ... ,  Q_7) <- P( R_0,  R_1,  R_2, ... ,  R_7) of 16-bytes each
    P(Z,i+0,  i+1,  i+2,  i+3,
        i+4,  i+5,  i+6,  i+7,
        i+8,  i+9,  i+10, i+11,
        i+12, i+13, i+14, i+15);
  }

  for(uint8_t i = 0; i < 16; i+=2) {
    // Q_0 = Q[8:15] || Q[0:7]
    // const ids = [0, 1, 2, 3, 4, 5, 6, 7].map(j => i*16 + j*128); // 128 .. 896 | 16, 144 .. 912 | ..
    // ( Z_0,  Z_8, Z_16, ... , Z_56) <- P( Q_0,  Q_8, Q_16, ... , Q_56) of 16-bytes each
    // ( Z_1,  Z_9, Z_17, ... , Z_57) <- P( Q_1,  Q_9, Q_17, ... , Q_57) ...
    P(Z, i+0, i+1, i+16, i+17,
         i+32, i+33, i+48, i+49,
         i+64, i+65, i+80, i+81,
         i+96, i+97, i+112, i+113); // store one column of Z at a time
  }

  xor(R, R, Z);
  
}

// G^2
EMSCRIPTEN_KEEPALIVE void G2(uint64_t* X, uint64_t* Y, uint64_t* R, uint64_t* Z) {
  G( X, Y, R, Z );
  G( X, R, R, Z );
}
#endif

// Returns out = [l, z]
EMSCRIPTEN_KEEPALIVE uint32_t* getLZ(uint32_t* out, uint32_t* J1J2, uint32_t currentLane, uint32_t p, uint32_t pass, uint32_t slice, uint32_t segmentOffset, uint32_t SL, uint32_t segmentLength) {
  // For the first pass (r=0) and the first slice (sl=0), the block is taken from the current lane.
  uint32_t l = (pass == 0 && slice == 0) ? currentLane : J1J2[1] % p;

  // W includes the indices of all blocks in the last SL - 1 = 3 segments computed and finished (possibly from previous pass, if any).
  // Plus, if `l` is on the current lane, we can also reference the finished blocks in the current segment (up to 'offset')
  uint32_t offset = l == currentLane
    ? segmentOffset - 1
    : segmentOffset == 0 ? -1 : 0; // If B[i][j] is the first block of a segment, then the very last index from W is excluded.
  uint32_t segmentCount = pass == 0 ? slice : SL-1;
  uint64_t W_area  = segmentCount * segmentLength + offset;
  // cast to uint64_t since we don't want the multiplication to be in uint32_t space
  uint32_t x = ((uint64_t)J1J2[0] * J1J2[0]) >> 32;
  uint32_t y = (W_area * x) >> 32;
  uint32_t zz = W_area - 1 - y;
  uint32_t startPos = pass == 0 ? 0 : (slice + 1) * segmentLength; // next segment (except for first pass)
  // TODO (?) possible optimisation: zz < 2 * (SL * segmentLength) so we can use an if instead of %
  uint32_t z = (startPos + zz) % (SL * segmentLength);
  out[0] = l;
  out[1] = z;
  return out;
}