/*====================================================================================================*
 * test_file.ts
 *====================================================================================================*/

import { BigNumber } from "bignumber.js"
import Hasher from "js-sha3"
import * as conversion from "./conversion"

/*====================================================================================================*/

export function generate_test_file(n: number): Buffer {
  let buf: Buffer = new Buffer(0)
  let x = conversion.buffer_from_uint256(new BigNumber(0))
  for (let i = 0; i < n; i++) {
    x = conversion.buffer_from_uint256(new BigNumber(Hasher.keccak256(x), 16))
    buf = Buffer.concat([buf, x])
  }
  return buf
}

/*====================================================================================================*/
