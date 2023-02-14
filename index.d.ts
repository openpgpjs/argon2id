import type { computeHash, Argon2idParams } from "./lib/setup";

/**
 * Setup an `argon2id` instance, by loading the Wasm module that is used under the hood. The SIMD version is used as long as the platform supports it.
 * The loaded module is then cached across `argon2id` calls.
 * NB: the used Wasm memory is cleared across runs, but not de-allocated.
 * Re-loading is thus recommended in order to free the memory if multiple `argon2id` hashes are computed
 * and some of them require considerably more memory than the rest.
 * @returns argon2id function
 */
export function loadWasm(): Promise<computeHash>;
export default loadWasm;
export type { Argon2idParams, computeHash };
