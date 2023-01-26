import setupWasmLoader from './lib/setup.js';
import wasmSIMD from './dist/simd.wasm';
import wasmNonSIMD from './dist/no-simd.wasm';

function decodeWasmBinary(base64) {
  const decoded = atob(base64);
  const binary = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
      binary[i] = decoded.charCodeAt(i);
  }
  return binary;
}

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
    () => decodeWasmBinary(wasmSIMD),
    () => decodeWasmBinary(wasmSIMD)
  );
}
