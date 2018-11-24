/*====================================================================================================*
 * interfaces.ts
 *====================================================================================================*/

export interface Spellcheck_init {
  sc_id: string
  requestor: string
  word: string
  value: string
  req_value: string
}

export interface Spellcheck_update {
  sc_id: string
  low: string
  high: string
  req_id: string
  start: string
  end: string
}

export interface Spellcheck_end {
  sc_id: string
  valid: boolean
  unspent_value: string
}

export interface Spellcheck_refund {
  sc_id: string
  value: string
}

/*====================================================================================================*/
