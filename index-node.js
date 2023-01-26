import fs from 'fs';
import setupWasmLoader from './lib/setup.js';

const SIMD_FILENAME = './dist/simd.wasm';
const NON_SIMD_FILENAME = './dist/no-simd.wasm';

/**
 * Setup an `argon2id` instance, by loading the Wasm module that is used under the hood.
 * The loaded module is then cached across `argon2id` calls.
 * NB: the used Wasm memory is cleared across runs, but not de-allocated.
 * Re-loading is thus recommended in order to free the memory if multiple `argon2id` hashes are computed
 * and some of them require considerably more memory than the rest.
 * @returns argon2id function
 */
export default async function load() {
  return setupWasmLoader(
    () => fs.readFileSync(SIMD_FILENAME),
    () => fs.readFileSync(NON_SIMD_FILENAME),
  );
}
