/*====================================================================================================*
 * conversion.ts
 *====================================================================================================*/

import assert from "assert"
import { BigNumber } from "bignumber.js"
import BN from "bn.js"
import bs58 from "bs58"

/*====================================================================================================*/

export function ipfs_multihash_from_uint256(x: BN): string {
  return bs58.encode(Buffer.concat([new Buffer([0x12, 0x20]), buffer_from_uint256(x)]))
}

/*====================================================================================================*/

export function uint256_from_ipfs_multihash(ipfs_multihash: string): BN {
  const buf = Buffer.from(bs58.decode(ipfs_multihash))
  assert(buf.length >= 2)
  assert(buf[0] === 0x12)
  assert(buf[1] === 0x20)
  return uint256_from_buffer(buf.slice(2))
}

/*====================================================================================================*/

export function buffer_from_uint256(x: BN): Buffer {
  // smoelius: The next comment should be revisited now that I am using BN instead of BigNumber.
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

export function uint256_from_buffer(buf: Buffer): BN {
  assert(buf.length === 32)
  return new BN(buf.toString("hex"), 16)
}

/*====================================================================================================*/

export function bignumber_from_bn(x: BN): BigNumber {
  return new BigNumber(x.toString(10))
}

/*====================================================================================================*/

export function bn_from_bignumber(x: BigNumber): BN {
  return new BN(x.toString(10))
}

/*====================================================================================================*/

export function to_hex(x: BN): string {
  return "0x" + x.toString(16)
}

/*====================================================================================================*/

export function json_equals<T>(x: T, y: T): boolean {
  return JSON.stringify(x) === JSON.stringify(y)
}

/*====================================================================================================*/
