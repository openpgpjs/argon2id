export class Blake2b {
  update(input: Uint8Array): this;
  digest(): ArrayBuffer;
}

export default function createHash(outlen: number, key?: Uint8Array, salt?: Uint8Array, personal?: Uint8Array): Blake2b;
