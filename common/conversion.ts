/*====================================================================================================*
 * conversion.ts
 *====================================================================================================*/

import assert from "assert"
import { BigNumber } from "bignumber.js"
import bs58 from "bs58"

/*====================================================================================================*/

export function ipfs_multihash_from_uint256(x: BigNumber): string {
  return bs58.encode(Buffer.concat([new Buffer([0x12, 0x20]), buffer_from_uint256(x)]))
}

/*====================================================================================================*/

export function uint256_from_ipfs_multihash(ipfs_multihash: string): BigNumber {
  const buf = Buffer.from(bs58.decode(ipfs_multihash))
  assert(buf.length >= 2)
  assert(buf[0] === 0x12)
  assert(buf[1] === 0x20)
  return uint256_from_buffer(buf.slice(2))
}

/*====================================================================================================*/

export function buffer_from_uint256(x: BigNumber): Buffer {
  // smoelius: The best way that I know to convert a buffer to a BigNumber is to go through string.
  // See, e.g.,:
  //   https://github.com/MikeMcl/bignumber.js/issues/115
  //   https://github.com/MikeMcl/bignumber.js/issues/117
  //   https://github.com/MikeMcl/bignumber.js/pull/127
  // In doing so, one has to ensure that the string is left padded with zeroes.
  let s = x.toString(16)
  assert(s.length <= 64)
  while (s.length < 64) {
    s = "0" + s
  }
  const buf = Buffer.from(s, "hex")
  assert(buf.length === 32)
  return buf
}

/*====================================================================================================*/

export function uint256_from_buffer(buf: Buffer): BigNumber {
  assert(buf.length === 32)
  return new BigNumber(buf.toString("hex"), 16)
}

/*====================================================================================================*/

export function to_bignumber(value: string): BigNumber {
  return new BigNumber(value)
}

/*====================================================================================================*/

export function json_equals<T>(x: T, y: T): boolean {
  return JSON.stringify(x) === JSON.stringify(y)
}

/*====================================================================================================*/
