#!/usr/bin/env bash

EMCC_COMMON_FLAGS="-O3 --no-entry -sWASM=1 lib/wasm.c -sTOTAL_MEMORY=2000mb"
DOCKER_OPTIONS="--rm \
  -v $(pwd):/src \
  -u $(id -u):$(id -g)"

docker run \
  $DOCKER_OPTIONS \
  emscripten/emsdk \
  emcc $EMCC_COMMON_FLAGS -o dist/no-simd.wasm

# compiling with -sWASM_BIGINT changes the output, but it does not seem to boost performance,
# and it might make the binary incompatible with platforms that do not support BigInts, so for now we do not set the flat
docker run \
  $DOCKER_OPTIONS \
  emscripten/emsdk \
  emcc $EMCC_COMMON_FLAGS -msimd128 -msse2 -o dist/simd.wasm
