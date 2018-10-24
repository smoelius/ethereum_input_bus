/*====================================================================================================*
 * ipfs_multihash_from_uint256.ts
 *====================================================================================================*/

import { BigNumber } from "bignumber.js"
import { ipfs_multihash_from_uint256 } from "../common/src/conversion"
import { program_invocation_short_name } from "../common/src/err"

/*====================================================================================================*/

if (process.argv.length !== 3) {
  console.error("%s: expect one argument: uint256", program_invocation_short_name)
  process.exit(1)
}

console.log("%s", ipfs_multihash_from_uint256(new BigNumber(process.argv[2])))

/*====================================================================================================*/
