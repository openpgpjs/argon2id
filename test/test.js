const test = require('tape')
const blake2b = require('../')
const vectors = require('./test-vectors.json')

runTests()

function runTests () {
  test('vectors', function (assert) {
    vectors.forEach(function (v) {
      const input = hexToUint8Array(v.input)
      const key = v.key && hexToUint8Array(v.key)
      const salt = v.salt && hexToUint8Array(v.salt)
      const personal = v.personal && hexToUint8Array(v.personal)

      const expected = hexToUint8Array(v.out)
      const actual = new Uint8Array(
        blake2b(v.outlen, key, salt, personal, true)
          .update(input)
          .digest()
      )

      assert.deepEquals(actual, expected)
    })
    assert.end()
  })

  test('works with buffers', function (assert) {
    const vector = vectors.slice(-1)[0]

    const input = Buffer.from(vector.input, 'hex')
    const key = Buffer.from(vector.key, 'hex')
    const salt = Buffer.from(vector.salt, 'hex')
    const personal = Buffer.from(vector.personal, 'hex')

    const expected = Buffer.from(vector.out, 'hex')
    const actual = Buffer.from(blake2b(vector.outlen, key, salt, personal).update(input).digest())

    assert.deepEquals(actual, expected)
    assert.end()
  })

  test('streaming', function (t) {
    var instance = blake2b(32)
    var buf = Buffer.from('Hej, Verden')

    for (var i = 0; i < 10; i++) instance.update(buf)

    const out = Buffer.from(instance.digest())

    t.same(out.toString('hex'), 'cbc20f347f5dfe37dc13231cbf7eaa4ec48e585ec055a96839b213f62bd8ce00', 'streaming hash')
    t.end()
  })

  test('streaming with key', function (t) {
    var key = Buffer.alloc(32)
    key.fill('lo')

    var instance = blake2b(32, key)
    var buf = Buffer.from('Hej, Verden')

    for (var i = 0; i < 10; i++) instance.update(buf)

    const out = Buffer.from(instance.digest())

    t.same(out.toString('hex'), '405f14acbeeb30396b8030f78e6a84bab0acf08cb1376aa200a500f669f675dc', 'streaming keyed hash')
    t.end()
  })

  test('streaming with hash length', function (t) {
    const instance = blake2b(16)
    const buf = Buffer.from('Hej, Verden')

    for (let i = 0; i < 10; i++) instance.update(buf)

    const out = Buffer.from(instance.digest())

    t.same(out.toString('hex'), 'decacdcc3c61948c79d9f8dee5b6aa99', 'streaming short hash')
    t.end()
  })

  test('calling update() after digest() should error', function (t) {
    const instance = blake2b(16)
    const buf = Buffer.from('Hej, Verden')

    instance.update(buf)
    instance.digest()

    t.throws(() => instance.update(buf))
    t.end()
  })

  test('streaming with key and hash length', function (t) {
    const key = Buffer.alloc(32)
    key.fill('lo')

    const instance = blake2b(16, key)
    const buf = Buffer.from('Hej, Verden')

    for (let i = 0; i < 10; i++) instance.update(buf)

    const out = Buffer.from(instance.digest())

    t.same(out.toString('hex'), 'fb43f0ab6872cbfd39ec4f8a1bc6fb37', 'streaming short keyed hash')
    t.end()
  })
}

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
