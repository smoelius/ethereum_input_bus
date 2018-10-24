/*====================================================================================================*
 * uint256_from_ipfs_multihash.ts
 *====================================================================================================*/

import { uint256_from_ipfs_multihash } from "../common/src/conversion"
import { program_invocation_short_name } from "../common/src/err"

/*====================================================================================================*/

if (process.argv.length !== 3) {
  console.error("%s: expect one argument: IPFS multihash", program_invocation_short_name)
  process.exit(1)
}

console.log("0x%s", uint256_from_ipfs_multihash(process.argv[2]).toString(16))

/*====================================================================================================*/
