export interface Argon2idParams {
  password: Uint8Array;
  salt: Uint8Array;
  /** Degree of parallelism (number of lanes) */
  parallelism: number;
  /** Number of iterations */
  passes: number;
  /** Memory cost in kibibytes */
  memorySize: number;
  /** Output tag length */
  tagLength: number;
  /** Associated Data */
  ad?: Uint8Array;
  /** Secret Data */
  secret?: Uint8Array;
}

declare function argon2id(params: Argon2idParams): Uint8Array;
export type computeHash = typeof argon2id;

type MaybePromise<T> = T | Promise<T>;

declare function customInstanceLoader(importObject: WebAssembly.Imports): MaybePromise<WebAssembly.WebAssemblyInstantiatedSource>;

/**
 * Load Wasm module and return argon2id wrapper.
 * It is platform-independent and it relies on the two functions given in input to instatiate the Wasm instances.
 * @param getSIMD - function instantiating and returning the SIMD Wasm instance
 * @param getNonSIMD - function instantiating and returning the non-SIMD Wasm instance
 * @returns {computeHash}
 */
export default function setupWasm(
  getSIMD: typeof customInstanceLoader,
  getNonSIMD: typeof customInstanceLoader,
): Promise<computeHash>;
