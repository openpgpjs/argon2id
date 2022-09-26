# `blake2b`

[![Build Status](https://travis-ci.org/emilbayes/blake2b.svg?branch=master)](https://travis-ci.org/emilbayes/blake2b)

> Blake2b (64-bit version) in Javascript

This module is a fork of @emilbayes
[implementation of BLAKE2b](https://github.com/emilbayes/blakejs), with some changes aimed at improving security and reducing the module size.

In particular, this version aims to be algorithmic constant time, and it does not include a WASM fallback.

## Install

```sh
npm install @openpgpjs/blake2b
```

## Usage
### Basic example
```js
const blake2b = require('blake2b')

var outputLength = 64;
var input = Buffer.from('hello world')

const hashedBuffer = blake2b(outputLength) // initialise
  .update(input) // input data to hash (can be called multiple times, e.g. when streaming)
  .digest() // finalize digest and return output buffer

const hashed = new Uint8Array(hashedBuffer);
```

### API

- `const hashInstance = blake2b(outLength, [key], [salt], [personal])`

Create a new hash instance, optionally with `key`, `salt` and
`personal`.
All parameters must be `Uint8Array` or `Buffer`.

- `hashInstance.update(input)`

Update the hash with new `input` data. Calling this method after `.digest` will throw an error.

- `const hashed = new Uint8Array(hashInstance.digest())`

Finalise the the hash and return the output buffer with the digest.


## Limitations
Can only handle up to 2**53 bytes of input (8 petabytes)


## Test vectors

This repository includes test vectors for testing conformance
against the spec and other implementations:

* Most tests are taken from [BLAKE2 test vectors](https://github.com/BLAKE2/BLAKE2/blob/5cbb39c9ef8007f0b63723e3aea06cd0887e36ad/testvectors/blake2-kat.json)
* Tests for hashing with key, salt and personalization are derived from the [libsodium tests](https://github.com/jedisct1/libsodium/blob/3a9c4c38f7dbe671d91dcfa267c919734b4923df/test/default/generichash3.c)

