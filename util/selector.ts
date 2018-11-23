/*====================================================================================================*
 * selector.ts
 *====================================================================================================*/

import { program_invocation_short_name } from "../common/src/err"
import { selector } from "../common/src/eth"

/*====================================================================================================*/

if (process.argv.length !== 3) {
  console.error("%s: expect one argument: function signature", program_invocation_short_name)
  process.exit(1)
}

console.log("%s", selector(process.argv[2]))

/*====================================================================================================*/
