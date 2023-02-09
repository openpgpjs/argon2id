import fs from 'fs';
import setupWasm from '../../lib/setup.js';

const SIMD_FILENAME = './dist/simd.wasm';
const NON_SIMD_FILENAME = './dist/no-simd.wasm';

/**
 * Simple wasm loader for Node, that does not require bundlers:
 * it reads the wasm binaries from disk and instantiates them.
 * @returns argon2id function
 */
export default async function load() {
  return setupWasm(
    (importObject) => WebAssembly.instantiate(fs.readFileSync(SIMD_FILENAME), importObject),
    (importObject) => WebAssembly.instantiate(fs.readFileSync(NON_SIMD_FILENAME), importObject),
  );
}

