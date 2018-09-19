/*====================================================================================================*
 * guard.ts
 *====================================================================================================*/

import * as checker from "ts-interface-checker"
import * as interfaces from "./interfaces"
import ti from "./interfaces-ti"

/*====================================================================================================*/

/* tslint:disable no-string-literal */
ti["BigNumber"] = checker.iface([], {})
/* tslint:enable no-string-literal */

const checkers = checker.createCheckers(ti)

export const guard = {
  Configuration: check<interfaces.Configuration>(checkers.Configuration)
}

export function check<T>(checker: checker.Checker): (obj: any) => T {
  return (obj: any) => {
    checker.check(obj)
    return obj
  }
}

/*====================================================================================================*/
