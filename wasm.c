#include <stdint.h>
// #include <stdio.h>
#undef EMSCRIPTEN_KEEPALIVE
#define EMSCRIPTEN_KEEPALIVE __attribute__((used)) __attribute__((retain))
EMSCRIPTEN_KEEPALIVE uint64_t umul64(uint64_t a, uint64_t b)
{
    // uint64_t a_lo = (uint64_t)(uint32_t)a;
    // uint64_t a_hi = a >> 32;
    // uint64_t b_lo = (uint64_t)(uint32_t)b;
    // uint64_t b_hi = b >> 32;

    // uint64_t p0 = a_lo * b_lo;
    // uint64_t p1 = a_lo * b_hi;
    // uint64_t p2 = a_hi * b_lo;
    // // uint64_t p3 = a_hi * b_hi;

    // uint32_t cy = (uint32_t)(((p0 >> 32) + (uint32_t)p1 + (uint32_t)p2) >> 32);

    // uint64_t res = p0 + (p1 << 32) + (p2 << 32);
    uint64_t res = a * b;

    return res;
    // *hi = p3 + (p1 >> 32) + (p2 >> 32) + cy;
}


// int main()
// {
//   printf("loaded\n");
// }
uint64_t rotr64(uint64_t x, uint64_t n) { return (x >> n) ^ (x << (64 - n)); }

#define LSB(x) ((x) & 0xffffffff)
void xor(uint64_t* out, uint64_t* x, uint64_t* y){for(uint8_t i = 0; i < 128; i++) out[i] = x[i] ^ y[i];}


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


// EMSCRIPTEN_KEEPALIVE void allGB(uint64_t* v) {
//   GB(v, 0,  4, 8, 12);
//   GB(v, 1,  5, 9, 13);
//   GB(v, 2, 6, 10, 14);
//   GB(v, 3, 7, 11, 15);

//   GB(v, 0, 5, 10, 15);
//   GB(v, 1, 6, 11, 12);
//   GB(v, 2, 7, 8, 13);
//   GB(v, 3,  4, 9, 14);
// }
