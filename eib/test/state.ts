/*====================================================================================================*
 * state.ts
 *====================================================================================================*/

import { Test_context } from "../../common/src/test"

/*====================================================================================================*/

/* smoelius: The following are old comments from Input_bus.sol.  They should motivate the tests within
 * this file.
 *
 * Desired invariants amongst requestor, FLAG_REQST_CANCELED, supplier, and FLAG_REQST_PAIDOUT:
 *
 *   FLAG_REQST_CANCELED ==> requestor != 0
 *   FLAG_REQST_CANCELED ==> supplier == 0
 *   FLAG_REQST_CANCELED ==> !FLAG_REQST_PAIDOUT
 *
 *   supplier != 0 ==> requestor != 0
 *   supplier != 0 ==> !FLAG_REQST_CANCELED
 *
 *   FLAG_REQST_PAIDOUT ==> requestor != 0
 *   FLAG_REQST_PAIDOUT ==> !FLAG_REQST_CANCELED
 *   FLAG_REQST_PAIDOUT ==> supplier != 0
 */

/*====================================================================================================*/

export function state(context: Test_context): void {

  /*==================================================================================================*/

  describe("stress tests", function(): void {
    this.timeout(2000) // 2 seconds
  })

  /*==================================================================================================*/

}

/*====================================================================================================*/
