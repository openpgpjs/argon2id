import test from 'tape';
import blake2b from '../lib/blake2b.js';
import vectors from './blake2b.vectors.json' assert { type: "json" };
import { hexToUint8Array } from './utils.js';

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

