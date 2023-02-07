#!/usr/bin/env bash

EMCC_COMMON_FLAGS="-O3 --no-entry -sWASM=1 lib/wasm.c -sIMPORTED_MEMORY=1 -sALLOW_MEMORY_GROWTH=1 -sMAXIMUM_MEMORY=4gb -sINITIAL_MEMORY=65mb"

DOCKER_OPTIONS="docker run --rm \
  -v $(pwd):/src \
  -u $(id -u):$(id -g) \
  emscripten/emsdk"

if [[ ! -z "$CI" ]]; then
  # In the CI (Github Actions), we are already inside the docker container, so we can run commands directly
  DOCKER_OPTIONS=""
fi

$DOCKER_OPTIONS \
  emcc $EMCC_COMMON_FLAGS -o dist/no-simd.wasm

# compiling with -sWASM_BIGINT changes the output, but it does not seem to boost performance,
# and it might make the binary incompatible with platforms that do not support BigInts, so for now we do not set the flat
$DOCKER_OPTIONS \
  emcc $EMCC_COMMON_FLAGS -msimd128 -msse2 -o dist/simd.wasm
