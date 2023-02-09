import argon2id from "./argon2id.js";

let isSIMDSupported;
async function wasmLoader(memory, getSIMD, getNonSIMD) {
  const importObject = { env: { memory } };
  if (isSIMDSupported === undefined) {
    try {
      isSIMDSupported = true; // will be overwritten in the catch
      return await getSIMD(importObject);
    } catch(e) {
      isSIMDSupported = false;
    }
  }

  const loader = isSIMDSupported ? getSIMD : getNonSIMD;
  return loader(importObject);
}

/**
 * Load Wasm module and return argon2id wrapper.
 * It is platform-independent and it uses the Wasm binary data returned by the two functions given in input.
 * @param {() => Uint8Array} getSIMD - function returning the SIMD Wasm binary data
 * @param {() => Uint8Array} getNonSIMD - function returning the non-SIMD Wasm binary data
 * @returns {computeHash}
 */
export default async function setupWasmLoader(getSIMD, getNonSIMD) {
  const memory = new WebAssembly.Memory({
    // in pages of 64KiB each
    // these values need to be compatible with those declared when building in `build-wasm`
    initial: 1040,  // 65MB
    maximum: 65536, // 4GB
  });
  const wasmModule = await wasmLoader(memory, getSIMD, getNonSIMD);

  /**
   * Argon2id hash function
   * @callback computeHash
   * @param {object} params
   * @param {Uint8Array} params.pwd - password
   * @param {Uint8Array} params.salt - salt
   * @return {Uint8Array} argon2id hash
   */
  const computeHash = (params) => argon2id(params, { instance: wasmModule.instance, memory });

  return computeHash;
}
