/*====================================================================================================*
 * math.ts
 *====================================================================================================*/

import assert from "assert"
import BN from "bn.js"
import Web3 from "web3"
import * as conversion from "../../common/src/conversion"

declare const it: (title: string, fn: () => Promise<void>) => void

/*====================================================================================================*/

describe("conversions", () => {
  const max_length = 256
  const stride = 32
  for (let length = 0; length <= max_length; length += stride) {
    const x = new BN(1).shln(length).subn(1)
    it(title("x = uint256_from_ipfs_multihash(ipfs_multihash_from_uint256(x))", length), async () =>
      assert(x.eq(conversion.uint256_from_ipfs_multihash(conversion.ipfs_multihash_from_uint256(x))))
    )
    it(title("x = uint256_from_buffer(buffer_from_uint256(x))", length), async () =>
      assert(x.eq(conversion.uint256_from_buffer(conversion.buffer_from_uint256(x))))
    )
    it(title("x = bn_from_bignumber(bignumber_from_bn(x))", length), async () =>
      assert(x.eq(conversion.bn_from_bignumber(conversion.bignumber_from_bn(x))))
    )
    it(title("x = web3.utils.toBN(to_hex(x))", length), async () =>
      assert(x.eq(Web3.utils.toBN(conversion.to_hex(x))))
    )
  }
})

/*====================================================================================================*/

function title(base: string, length: number): string {
  return base + " (length = " + length + ")"
}

/*====================================================================================================*/
