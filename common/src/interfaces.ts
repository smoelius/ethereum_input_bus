/*====================================================================================================*
 * interfaces.ts
 *====================================================================================================*/

import BN from "bn.js"
import Web3 from "web3"
import * as web3_types from "web3/types"
import * as eib_types from "../../eib/types/web3-contracts"

/*====================================================================================================*/

export interface File_info {
  file_length: number
  merkle_tree: BN[]
}

/*====================================================================================================*/

export interface Echo {
  value: string
}

export interface Request_announced {
  req_id: string
  requestor: string
  file_addr_type: string
  file_addr: string[]
  start: string
  end: string
  ltiov: string
  callback_id: string // bytes4
  callback_gas: string
  value: string
}

export interface Request_canceled {
  req_id: string
}

export interface Request_supplied {
  req_id: string
  supplier: string
  data: string[]
  proof: string[]
  callback_gas_before: string
  callback_gas_after: string
  callback_result: boolean
}

export interface Request_paidout {
  req_id: string
  payee: string
  value: string
}

export interface Proxy_callback {
  req_id: string
  supplier: string
  data: string[]
  proof: string[]
  get_supplier_gas_before: string
  get_supplier_gas_after: string
  get_data_gas_before: string
  get_data_gas_after: string
  get_proof_gas_before: string
  get_proof_gas_after: string
  end_of_memory: string
}

/*====================================================================================================*/

// smoelius: From: https://github.com/gristlabs/ts-interface-builder
// Limitations
// This module currently does not support generics, except Promises.

export interface Pretest_context {
  options?: any
  web3?: Web3
  Input_bus_artifacts?: any
  eib?: eib_types.Input_bus
  Proxy_requestor_artifacts?: any
  proxy?: eib_types.Proxy_requestor
  handle_events?: (
      thunk: () => Promise<web3_types.TransactionReceipt>,
      options: web3_types.Logs,
      abi_event_callbacks: any[]
    ) => Promise<void>
}

export interface Test_context {
  options: any
  web3: Web3
  Input_bus_artifacts: any
  eib: eib_types.Input_bus
  Proxy_requestor_artifacts: any
  proxy: eib_types.Proxy_requestor
  handle_events: (
      thunk: () => Promise<web3_types.TransactionReceipt>,
      options: web3_types.Logs,
      abi_event_callbacks: any[]
    ) => Promise<void>
}

/*====================================================================================================*/
