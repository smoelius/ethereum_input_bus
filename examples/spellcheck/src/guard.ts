/*====================================================================================================*
 * guard.ts
 *====================================================================================================*/

import * as checker from "ts-interface-checker"
import * as interfaces from "./interfaces"
import ti from "./interfaces-ti"

/*====================================================================================================*/

/* tslint:disable no-string-literal */
// ti["BigNumber"] = checker.iface([], {})
/* tslint:enable no-string-literal */

const checkers = checker.createCheckers(ti)

export const guard = {
  Spellcheck_init: check<interfaces.Spellcheck_init>(checkers.Spellcheck_init),
  Spellcheck_update: check<interfaces.Spellcheck_update>(checkers.Spellcheck_update),
  Spellcheck_end: check<interfaces.Spellcheck_end>(checkers.Spellcheck_end),
  Spellcheck_refund: check<interfaces.Spellcheck_refund>(checkers.Spellcheck_refund),
}

export function check<T>(checker: checker.Checker): (obj: any) => T {
  return (obj: any) => {
    checker.check(obj)
    return obj
  }
}

/*====================================================================================================*/
