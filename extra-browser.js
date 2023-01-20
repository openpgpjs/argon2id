

import argon2id from './index.js';
import { uint8ArrayToHex } from './argon2id.js';
import wasmData from './wasm.wasm';

(async function() {
console.log(wasmData)
const wasmModule = await WebAssembly.instantiate(decodeWasmBinary(wasmData), {});

console.time('t3');
let tagT3
for(let i=0; i< 10; i++)
tagT3=await argon2id({
  pwd: hexToUint8Array('0101010101010101010101010101010101010101010101010101010101010101'),
  salt: hexToUint8Array('0202020202020202020202020202020202020202020202020202020202020202'),
  passes: 3, m_cost: Math.pow(2, 16), lanes: 4
}, wasmModule);
// const tagT3 = argon2id({
//   pwd: hexToUint8Array('0101010101010101010101010101010101010101010101010101010101010101'),
//   salt: hexToUint8Array('0202020202020202020202020202020202020202020202020202020202020202'),
//   passes: 1, m_cost: Math.pow(2, 21), lanes: 4
// });

console.timeEnd('t3');
console.log('got',uint8ArrayToHex(tagT3))
console.log('expected', '6904f1422410f8360c6538300210a2868f5e80cd88606ec7d6e7e93b49983cea')
})()
function hexToUint8Array (string) {
  const buf = new Uint8Array(string.length / 2);
  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  for (let i = 0; i < strLen / 2; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (Number.isNaN(parsed)) throw new Error('Invalid byte')
    buf[i] = parsed
  }
  return buf
}

function decodeWasmBinary(base64) {
  const text = atob(base64);
  const binary = new Uint8Array(new ArrayBuffer(text.length));
  for (let i = 0; i < text.length; i++) {
      binary[i] = text.charCodeAt(i);
  }
  return binary;
}