/*====================================================================================================*
 * interfaces.ts
 *====================================================================================================*/

import { BigNumber } from "bignumber.js"

/*====================================================================================================*/

export interface Spellcheck_init {
  sc_id: BigNumber
  requestor: string
  word: string
  value: BigNumber
  req_value: BigNumber
}

export interface Spellcheck_update {
  sc_id: BigNumber
  low: BigNumber
  high: BigNumber
  req_id: BigNumber
  start: BigNumber
  end: BigNumber
}

export interface Spellcheck_end {
  sc_id: BigNumber
  valid: boolean
  unspent_value: BigNumber
}

export interface Spellcheck_refund {
  sc_id: BigNumber
  value: BigNumber
}

/*====================================================================================================*/
