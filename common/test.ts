/*====================================================================================================*
 * test.ts
 *====================================================================================================*
 * smoelius: I use straight mocha instead of "truffle test" for the following reasons.
 * * I do not necessarily want to deploy a new instance of Input_bus, as "truffle test" would do.
 * * Truffle only decodes log entries for the invoked contract, which limits its applicability to my
 *   situation anyway.
 * Having said that, Truffle's method for decoding log entries is faster than any that I have found.
 * Perhaps Truffle preprocesses the relevant abis(?).  Currently, I am using (a seemingly outdated)
 * version of) ether-pudding to decode log entries from transaction receipts.  See:
 *   How do I parse the transaction receipt log with web3.js?
 *   https://ethereum.stackexchange.com/a/2101
 *====================================================================================================*/

import assert from "assert"
import types = require("ethereum-types")
import fs from "fs"
import Web3 from "web3"
import * as eth from "./eth"

/*====================================================================================================*/

export type Tx_hash = string

export interface Test_context {
  options: any
  web3: Web3
  eib: Web3.ContractInstance
  proxy: Web3.ContractInstance
  handle_events: (
      thunk: () => Tx_hash,
      filter_value: string | types.FilterObject,
      abi_callbacks: Array<eth.Abi_event_callback<boolean>>
    ) => void
}

/*====================================================================================================*/

export function test(options: any, callback: (context: Test_context) => void): void {

  const context: any = {}

  context.options = options

  /*==================================================================================================*/

  context.web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"))

  context.web3.eth.defaultAccount = context.web3.eth.accounts[0]

  /*==================================================================================================*/

  /* tslint:disable variable-name */
  const Input_bus_artifacts = JSON.parse(fs.readFileSync("build/contracts/Input_bus.json").toString())
  const Input_bus = context.web3.eth.contract(Input_bus_artifacts.abi)
  /* tslint:enable variable-name */

  assert(Object.keys(Input_bus_artifacts.networks).length === 1)
  const network = Object.keys(Input_bus_artifacts.networks)[0]

  context.eib = Input_bus.at(Input_bus_artifacts.networks[network].address)

  /*==================================================================================================*/

  /* tslint:disable variable-name */
  const Proxy_requestor_artifacts
    = JSON.parse(fs.readFileSync("build/contracts/Proxy_requestor.json").toString())
  const Proxy_requestor = context.web3.eth.contract(Proxy_requestor_artifacts.abi)
  /* tslint:enable variable-name */

  assert(Object.keys(Proxy_requestor_artifacts.networks).length === 1)
  assert(Object.keys(Proxy_requestor_artifacts.networks)[0] === network)

  context.proxy = Proxy_requestor.at(Proxy_requestor_artifacts.networks[network].address)

  /*==================================================================================================*/

  context.handle_events = test_handle_events(context)

  /*==================================================================================================*/

  callback(context)
}

/*====================================================================================================*/

function test_handle_events(context: Test_context): (
      thunk: () => Tx_hash,
      filter_value: string | types.FilterObject,
      abi_event_callbacks: Array<eth.Abi_event_callback<boolean>>
    ) => void {
  return (thunk, filter_value, abi_event_callbacks) => {
    if (!(context.options.external_supplier === true)) {
      const promised_receipt = eth.promisify<types.TransactionReceipt | null>(
        callback => context.web3.eth.getTransactionReceipt(thunk(), callback))
      eth.handle_receipt_events(promised_receipt, abi_event_callbacks)
    } else {
      eth.handle_block_events(context.web3, filter_value, abi_event_callbacks)
    }
  }
}

/*====================================================================================================*/
