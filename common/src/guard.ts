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
  Echo: check<interfaces.Echo>(checkers.Echo),
  Request_announced: check<interfaces.Request_announced>(checkers.Request_announced),
  Request_canceled: check<interfaces.Request_canceled>(checkers.Request_canceled),
  Request_supplied: check<interfaces.Request_supplied>(checkers.Request_supplied),
  Request_paidout: check<interfaces.Request_paidout>(checkers.Request_paidout),
  Proxy_callback: check<interfaces.Proxy_callback>(checkers.Proxy_callback)
}

export function check<T>(checker: checker.Checker): (obj: any) => T {
  return (obj: any) => {
    checker.check(obj)
    return obj
  }
}

/*====================================================================================================*/
