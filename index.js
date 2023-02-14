import setupWasm from './lib/setup.js';
import wasmSIMD from './dist/simd.wasm';
import wasmNonSIMD from './dist/no-simd.wasm';

const loadWasm = async () => setupWasm(
  (instanceObject) => wasmSIMD(instanceObject),
  (instanceObject) => wasmNonSIMD(instanceObject),
);

export default loadWasm;
