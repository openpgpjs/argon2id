import { expect } from 'chai';
import blake2b from '../lib/blake2b.js';
import vectors from './blake2b.vectors.json' assert { type: "json" };
import { hexToUint8Array } from './helpers/utils.js';

describe('blake2b tests', () => {
  describe('vectors', function () {
    vectors.forEach(function (v, i) {
      it(`vector ${i}`, () => {
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
        expect(actual).to.deep.equal(expected);
      });
    })
  });

  it('works with buffers', function () {
    const vector = vectors.slice(-1)[0]

    const input = Buffer.from(vector.input, 'hex')
    const key = Buffer.from(vector.key, 'hex')
    const salt = Buffer.from(vector.salt, 'hex')
    const personal = Buffer.from(vector.personal, 'hex')

    const expected = Buffer.from(vector.out, 'hex')
    const actual = Buffer.from(blake2b(vector.outlen, key, salt, personal).update(input).digest())

    expect(actual).to.deep.equal(expected)
  });

  it('streaming', function () {
    var instance = blake2b(32)
    var buf = Buffer.from('Hej, Verden')

    for (var i = 0; i < 10; i++) instance.update(buf)

    const out = Buffer.from(instance.digest())

    expect(out.toString('hex')).to.equal('cbc20f347f5dfe37dc13231cbf7eaa4ec48e585ec055a96839b213f62bd8ce00');
  });

  it('streaming with key', function () {
    var key = Buffer.alloc(32)
    key.fill('lo')

    var instance = blake2b(32, key)
    var buf = Buffer.from('Hej, Verden')

    for (var i = 0; i < 10; i++) instance.update(buf)

    const out = Buffer.from(instance.digest())

    expect(out.toString('hex')).to.equal('405f14acbeeb30396b8030f78e6a84bab0acf08cb1376aa200a500f669f675dc')
  });

  it('streaming with hash length', function () {
    const instance = blake2b(16)
    const buf = Buffer.from('Hej, Verden')

    for (let i = 0; i < 10; i++) instance.update(buf)

    const out = Buffer.from(instance.digest())

    expect(out.toString('hex')).to.equal('decacdcc3c61948c79d9f8dee5b6aa99')
  });

  it('calling update() after digest() should error', function () {
    const instance = blake2b(16)
    const buf = Buffer.from('Hej, Verden')

    instance.update(buf)
    instance.digest()

    expect(() => instance.update(buf)).to.throw()
  });

  it('streaming with key and hash length', function () {
    const key = Buffer.alloc(32)
    key.fill('lo')

    const instance = blake2b(16, key)
    const buf = Buffer.from('Hej, Verden')

    for (let i = 0; i < 10; i++) instance.update(buf)

    const out = Buffer.from(instance.digest())

    expect(out.toString('hex')).to.equal('fb43f0ab6872cbfd39ec4f8a1bc6fb37')
  });
});
