export function uint8ArrayToHex(bytes) {
  const res = new Array();
  for (let c = 0; c < bytes.length; c++) {
      const hex = bytes[c].toString(16);
      res.push(hex.length < 2 ? '0' + hex : hex);
  }
  return res.join('');
};

export function hexToUint8Array (string) {
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