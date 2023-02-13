# Argon2id

Fast, lightweight Argon2id implementation for both browser and Node:
- optimized for bundle size (< 7KB minified and gizipped, with wasm inlined as base64)
- SIMD support, with automatic fallback to non-SIMD binary if not supported (e.g. in Safari)
- performance is comparable to or better than [argon2-browser](https://github.com/antelle/argon2-browser).

We initially tried implementing a solution in pure JS (no Wasm) but the running time was unacceptable.
We resorted to implement part of the module in Wasm, to take advantage of 64-bit multiplications and SIMD instructions. The Wasm binary remains small thanks to the fact that the memory is fully managed by the JS side, hence no memory management function gets included in the Wasm binary.

## Install

Install from npm (compiled wasm files included):

```sh
npm i argon2id
```

## Usage

With bundlers like Rollup (through [plugin-wasm](https://www.npmjs.com/package/@rollup/plugin-wasm)) or Webpack (through [wasm-loader](https://www.npmjs.com/package/wasm-loader)), that automatically translate import statements like `import wasmModule from '*.wasm'` to a loader of type `wasmModule: (instanceOptions) => WebAssembly.WebAssemblyInstantiatedSource` (either sync or async), you can simply use the default export like so:

```js
import loadArgon2idWasm from 'argon2id';

const argon2id = await loadArgon2idWasm();
const hash = argon2id({
  password: new Uint8Array(...),
  salt: crypto.getRandomValues(new Uint8Array(32)),
  parallelism: 4,
  passes: 3,
  memorySize: 2**16
});
```
Refer to the [Argon2 RFC](https://www.rfc-editor.org/rfc/rfc9106.html#name-parameter-choice) for details about how to pick the parameters.

**Note about memory usage:** every call to `loadArgon2idWasm` will instantiate and run a separate Wasm instance, with separate memory.
The used Wasm memory is cleared after each call to `argon2id`, but it isn't deallocated (this is due to Wasm limitations).
Re-loading the Wasm module is thus recommended in order to free the memory if multiple `argon2id` hashes are computed and some of them require considerably more memory than the rest.

### Custom Wasm loaders

The library does not require a particular toolchain. If the aforementioned bundlers are not an option, you can manually take care of setting up the Wasm modules.

For instance, **in Node, the library can be used without bundlers**. You will need to pass two functions that instantiate the Wasm modules to `setupWasm` (first function is expected to take care of the SIMD binary, second one the non-SIMD one):

```js
import fs from 'fs';
import setupWasm from 'argon2id/lib/setup.js';

// point to compiled binaries
const SIMD_FILENAME = 'argon2id/dist/simd.wasm';
const NON_SIMD_FILENAME = 'argon2id/dist/no-simd.wasm';

const argon2id = await setupWasm(
  (importObject) => WebAssembly.instantiate(fs.readFileSync(SIMD_FILENAME), importObject),
  (importObject) => WebAssembly.instantiate(fs.readFileSync(NON_SIMD_FILENAME), importObject),
);
```

Using the same principle, for browsers you can use bundlers with simple base-64 file loaders. 

## Compiling

**The npm package already includes the compiled binaries.**<br>
If you fork the repo, you'll have to manually compile wasm (Docker required):
```sh
npm run build
```

The resulting binaries will be under `dist/`.
If you do not want to use docker, you can look into installing [emscripten](https://emscripten.org/); you'll find the compilation commands to use in `build_wasm.sh`.

