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

EMSCRIPTEN_KEEPALIVE void GB(uint64_t* v, int a, int b, int c, int d) {

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

EMSCRIPTEN_KEEPALIVE void allGB(uint64_t* v) {
  GB(v, 0,  4, 8, 12);
  GB(v, 1,  5, 9, 13);
  GB(v, 2, 6, 10, 14);
  GB(v, 3, 7, 11, 15);

  GB(v, 0, 5, 10, 15);
  GB(v, 1, 6, 11, 12);
  GB(v, 2, 7, 8, 13);
  GB(v, 3,  4, 9, 14);
}