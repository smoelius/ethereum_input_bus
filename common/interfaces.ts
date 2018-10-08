/*====================================================================================================*
 * interfaces.ts
 *====================================================================================================*/

import { BigNumber } from "bignumber.js"

/*====================================================================================================*/

export interface File_info {
  file_length: number
  merkle_tree: BigNumber[]
}

/*====================================================================================================*/

export interface Echo {
  value: BigNumber
}

export interface Request_announced {
  req_id: BigNumber
  requestor: string
  file_addr_type: BigNumber
  file_addr: BigNumber[]
  start: BigNumber
  end: BigNumber
  ltiov: BigNumber
  callback_id: string // bytes4
  callback_gas: BigNumber
  value: BigNumber
}

export interface Request_canceled {
  req_id: BigNumber
}

export interface Request_supplied {
  req_id: BigNumber
  supplier: string
  data: string[]
  proof: string[]
  callback_gas_before: BigNumber
  callback_gas_after: BigNumber
  callback_result: boolean
}

export interface Request_paidout {
  req_id: BigNumber
  payee: string
  value: BigNumber
}

export interface Proxy_callback {
  req_id: BigNumber
  supplier: string
  data: string[]
  proof: string[]
  get_supplier_gas_before: BigNumber
  get_supplier_gas_after: BigNumber
  get_data_gas_before: BigNumber
  get_data_gas_after: BigNumber
  get_proof_gas_before: BigNumber
  get_proof_gas_after: BigNumber
  end_of_memory: BigNumber
}

/*====================================================================================================*/
