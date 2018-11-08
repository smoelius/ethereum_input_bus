/*====================================================================================================*
 * math.ts
 *====================================================================================================*/

import * as interfaces from "../../common/src/interfaces"

declare const it: (title: string, fn: () => Promise<void>) => void

/*====================================================================================================*/

/* smoelius: The following are comments from stress.ts.  They should motivate the tests within this
 * file.
 *
 *   console.log(`data:                    ${data.map(x => x.toString(16))}`)
 *   console.log(`data_negated_first_bit:  ${data_negated_first_bit.map(x => x.toString(16))}`)
 *   console.log(`data_negated_last_bit:   ${data_negated_last_bit.map(x => x.toString(16))}`)
 *   console.log(`proof:                   ${proof.map(x => x.toString(16))}`)
 *   console.log(`proof_negated_first_bit: ${proof_negated_first_bit.map(x => x.toString(16))}`)
 *   console.log(`proof_negated_last_bit:  ${proof_negated_last_bit.map(x => x.toString(16))}`)
 */

/*====================================================================================================*/

export function math(context: interfaces.Test_context): void {

  /*==================================================================================================*/

  describe("math tests", function(): void {
    this.timeout(2000) // 2 seconds
  })

  /*==================================================================================================*/

}

/*====================================================================================================*/
