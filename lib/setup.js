import argon2id from "./argon2id.js";

let isSIMDSupported;
async function wasmLoader(getSIMD, getNonSIMD) {
  if (isSIMDSupported === undefined) {
    try {
      isSIMDSupported = true; // will be overwritten in the catch
      return await WebAssembly.instantiate(getSIMD(), {});
    } catch(e) {
      isSIMDSupported = false;
    }
  }

  const wasmBuffer = isSIMDSupported ? getSIMD() : getNonSIMD();
  return WebAssembly.instantiate(wasmBuffer, {});
}

/**
 * Load Wasm module and return argon2id wrapper.
 * It is platform-independent and it uses the Wasm binary data returned by the two functions given in input.
 * @param {() => Uint8Array} getSIMD - function returning the SIMD Wasm binary data
 * @param {() => Uint8Array} getNonSIMD - function returning the non-SIMD Wasm binary data
 * @returns {computeHash}
 */
export default async function setupWasmLoader(getSIMD, getNonSIMD) {
  const wasmModule = await wasmLoader(getSIMD, getNonSIMD);

  /**
   * Argon2id hash function
   * @callback computeHash
   * @param {object} params
   * @param {Uint8Array} params.pwd - password
   * @param {Uint8Array} params.salt - salt
   * @return {Uint8Array} argon2id hash
   */
  const computeHash = (params) => argon2id({ outlen: 32, ...params }, wasmModule.instance);

  return computeHash;
}
