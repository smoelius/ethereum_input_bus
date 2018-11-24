/*====================================================================================================*
 * test.ts
 *====================================================================================================*
 * smoelius: I use straight mocha instead of "truffle test" for the following reasons.
 * * I do not necessarily want to deploy a new instance of Input_bus, as "truffle test" would do.
 * * Truffle only decodes log entries for the invoked contract, which limits its applicability to my
 *   situation anyway.
 *====================================================================================================*/

import assert from "assert"
import fs from "fs"
import Web3 from "web3"
import * as web3_types from "web3/types"
import * as eib_types from "../../eib/types/web3-contracts"
import * as eth from "./eth"
import { guard } from "./guard"
import * as interfaces from "./interfaces"

/*====================================================================================================*/

export function test(callback: (context: interfaces.Test_context) => void): void {

  const precontext: interfaces.Pretest_context = {}

  precontext.options = {
    external_supplier: process.env["EIB_EXTERNAL_SUPPLIER"] ? true : false
  }

  /*==================================================================================================*/

  // smoelius: For why the use of websockets, see Adam Kipnis's answer to:
  //   web3.eth.subscribe not implemented for web3 version 1.0.0-beta.27
  //   https://stackoverflow.com/a/48174309
  precontext.web3 = new Web3(new Web3.providers.WebsocketProvider("ws://localhost:8545"))

  /*==================================================================================================*/

  precontext.Input_bus_artifacts
    = JSON.parse(fs.readFileSync("build/contracts/Input_bus.json").toString())

  assert(Object.keys(precontext.Input_bus_artifacts.networks).length === 1)
  const network = Object.keys(precontext.Input_bus_artifacts.networks)[0]

  precontext.eib = new precontext.web3.eth.Contract(precontext.Input_bus_artifacts.abi,
    precontext.Input_bus_artifacts.networks[network].address) as eib_types.Input_bus

  /*==================================================================================================*/

  precontext.Proxy_requestor_artifacts
    = JSON.parse(fs.readFileSync("build/contracts/Proxy_requestor.json").toString())

  assert(Object.keys(precontext.Proxy_requestor_artifacts.networks).length === 1)
  assert(Object.keys(precontext.Proxy_requestor_artifacts.networks)[0] === network)

  precontext.proxy = new precontext.web3.eth.Contract(precontext.Proxy_requestor_artifacts.abi,
    precontext.Proxy_requestor_artifacts.networks[network].address) as eib_types.Proxy_requestor

  /*==================================================================================================*/

  precontext.handle_events = test_handle_events(precontext)

  /*==================================================================================================*/

  const context = guard.Test_context(precontext)

  callback(context)
}

/*====================================================================================================*/

export type handle_events_type = (
    thunk: () => Promise<web3_types.TransactionReceipt>,
    options: web3_types.Logs,
    abi_event_callbacks: Array<eth.Abi_event_callback<void>>
  ) => Promise<void>

function test_handle_events(precontext: interfaces.Pretest_context): handle_events_type {
  return (thunk, options, abi_event_callbacks) => {
    if (!(precontext.options.external_supplier === true)) {
      return thunk().then(eth.handle_receipt_events(abi_event_callbacks))
    } else {
      return eth.promise_of(eth.handle_block_events(precontext.web3 as Web3, options,
        abi_event_callbacks))
    }
  }
}

/*====================================================================================================*/
