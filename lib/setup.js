import argon2id from "./argon2id.js";

let isSIMDSupported;
async function wasmLoader(memory, getSIMD, getNonSIMD) {
  const importObject = { env: { memory } };
  if (isSIMDSupported === undefined) {
    try {
      const loaded = await getSIMD(importObject);
      isSIMDSupported = true;
      return loaded;
    } catch(e) {
      isSIMDSupported = false;
    }
  }

  const loader = isSIMDSupported ? getSIMD : getNonSIMD;
  return loader(importObject);
}

export default async function setupWasm(getSIMD, getNonSIMD) {
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
   * @param {Object} params
   * @param {Uint8Array} params.password - password
   * @param {Uint8Array} params.salt - salt
   * @param {Integer} params.parallelism
   * @param {Integer} params.passes
   * @param {Integer} params.memorySize - in kibibytes
   * @param {Integer} params.tagLength - output tag length
   * @param {Uint8Array} [params.ad] - associated data (optional)
   * @param {Uint8Array} [params.secret] - secret data (optional)
   * @return {Uint8Array} argon2id hash
   */
  const computeHash = (params) => argon2id(params, { instance: wasmModule.instance, memory });

  return computeHash;
}
