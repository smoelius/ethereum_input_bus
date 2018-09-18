/*====================================================================================================*
 * index.ts for Spellcheck
 *====================================================================================================*/

import { BigNumber } from "bignumber.js"
import types = require("ethereum-types")
import Web3 from "web3"
import * as conversion from "../../../common/conversion"
import * as eth from "../../../common/eth"
import { guard as eib_guard } from "../../../common/guard"
import * as math from "../../../common/math"
import { guard as sc_guard } from "./guard"
import * as sc_interfaces from "./interfaces"

// From: http://mikemcl.github.io/bignumber.js/
// Almost never return exponential notation:
BigNumber.config({ EXPONENTIAL_AT: 1e+9 })

/*====================================================================================================*/

declare global {
  interface Window {
    web3: Web3
    sc_address: string
    sc: any
    spellcheck: () => void
    cancel: () => void
  }
}

declare const Input_bus_artifacts: any
declare const Spellcheck_artifacts: any
declare const Dict_artifacts: any

/*====================================================================================================*/

const SPELLCHECK_GAS = 500000
const REFUND_GAS     = 300000

/*====================================================================================================*/

let gas_used: number
let filter: Web3.FilterResult

/*====================================================================================================*/

window.spellcheck = spellcheck
window.stop = stop

/*====================================================================================================*/

window.addEventListener("load", () => {
  (async () => {
    if (typeof window.web3 === "undefined") {
      return stop_with_error(false, "Spellcheck requires MetaMask.")
    }
    window.web3 = new Web3(window.web3.currentProvider)

    /* tslint:disable variable-name */
    const Spellcheck = window.web3.eth.contract(Spellcheck_artifacts.abi)
    /* tslint:enable variable-name */

    if (Object.keys(Spellcheck_artifacts.networks).length !== 1) {
      throw new Error("Internal error: Unexpected number of networks.")
    }
    const network = Object.keys(Spellcheck_artifacts.networks)[0]
    window.sc_address = Spellcheck_artifacts.networks[network].address

    window.sc = Spellcheck.at(window.sc_address)

    /* tslint:disable variable-name */
    const Dict = window.web3.eth.contract(Dict_artifacts.abi)
    /* tslint:enable variable-name */

    const dict_address = await eth.promisify<string>(window.sc.dict)

    const dict = Dict.at(dict_address)

    const file_addr = await eth.promisify<BigNumber[]>(dict.file_addr)

    const ipfs_multihash = conversion.ipfs_multihash_from_uint256(file_addr[0])
    const gas = math.ceil_div_big(file_addr[1], new BigNumber(32)).times(eth.G_SSET)

    set_text("ipfs_multihash", ipfs_multihash)
    set_text("file_length", file_addr[1].toString())
    set_text("file_gas", gas.toString())

    const request = new XMLHttpRequest()
    request.onreadystatechange = () => {
      if (request.readyState !== 4 || request.status !== 200) {
        return
      }
      const safe_low = JSON.parse(request.responseText).safeLow
      set_text("gas_rate", (safe_low / 10).toString())
      set_text("file_ether", gas.times(safe_low).dividedBy("10000000000").toString())
    }
    request.open("GET", "https://ethgasstation.info/json/ethgasAPI.json", true)
    request.send()
  })().catch((err) => {
    throw err
  })
})

window.addEventListener("keyup", (event) => {
  const spellcheck_container = cast<HTMLElement>(document.getElementById("spellcheck_container"))
  if (event.keyCode === 13 && window.getComputedStyle(spellcheck_container).visibility === "visible") {
    spellcheck()
  }
})

/*====================================================================================================*/

function spellcheck(): void {
  (async () => {
    const accounts = await eth.promisify(window.web3.eth.getAccounts)
    if (accounts.length <= 0) {
      return stop_with_error(false, "Please unlock MetaMask.")
    }

    const word = cast<HTMLInputElement>(document.getElementById("word")).value
    if (word === "") {
      return stop_with_error(false, "Please specify a word.")
    }
    const value = window.web3.toWei(cast<HTMLInputElement>(document.getElementById("value")).value,
      "finney")

    show("checking_message", false)
    show("valid_message", false)
    show("invalid_message", false)
    show("gas_used_container", false)
    show("value_used_container", false)
    show("value_refunded_container", false)

    enable("prompt_message", false)
    enable("word_label", false)
    enable("word", false)
    enable("value_label", false)
    enable("value", false)

    set_text("checking_word", word)
    set_text("valid_word", word)
    set_text("invalid_word", word)

    show("checking_message", true)

    show("spellcheck_container", false)
    show("cancel_container", true)

    const gas_price = await eth.promisify(window.web3.eth.getGasPrice)
    const tx_hash = await eth.promisify<string>((callback) => window.sc.spellcheck(
      word,
      {
        from: accounts[0],
        value: value,
        gas: SPELLCHECK_GAS,
        gasPrice: gas_price
      },
      callback
    ))
    const found = eth.handle_receipt_events(
      eth.promisify<types.TransactionReceipt | null>(
        (callback) => window.web3.eth.getTransactionReceipt(tx_hash, callback)),
      [{
        abi: window.sc.abi,
        event_callbacks: [{
          event: "Spellcheck_init",
          callback: (event, receipt) => {
            const sc_init = sc_guard.Spellcheck_init(event)
            if (!(sc_init.requestor === accounts[0]
                && sc_init.word === word
                && sc_init.value.equals(value))) {
              return false
            }
            gas_used = 0
            spellcheck_handle_receipt_events(sc_init,
              Promise.resolve(cast<types.TransactionReceipt | null>(receipt)))
            return true
          }
        }]
      }],
      (found) => {
        if (!found) {
          return stop_with_error(true, "Could not spellcheck initiation event.")
        }
      }
    )
  })().catch((err) => {
    throw err
  })
}

/*====================================================================================================*/

function spellcheck_handle_receipt_events(sc_init: sc_interfaces.Spellcheck_init,
    promised_receipt: Promise<types.TransactionReceipt | null>): void {
  const found = eth.handle_receipt_events(
    promised_receipt,
    [{
      abi: window.sc.abi,
      event_callbacks: [{
        event: "Spellcheck_update",
        callback: (event, receipt) => {
          const sc_update = sc_guard.Spellcheck_update(event)
          if (!sc_init.sc_id.equals(sc_update.sc_id)) {
            return false
          }
          update_gas_used(receipt)
          eth.handle_receipt_events(
            promised_receipt,
            [{
              abi: Input_bus_artifacts.abi,
              event_callbacks: [{
                event: "Request_announced",
                callback: (event, receipt) => {
                  const request = eib_guard.Request_announced(event)
                  if (!(window.sc_address === request.requestor
                      && sc_update.req_id.equals(request.req_id))) {
                    return false
                  }
                  filter = eth.handle_block_events(
                    window.web3,
                    { fromBlock: receipt.blockNumber },
                    [{
                      abi: Input_bus_artifacts.abi,
                      event_callbacks: [{
                        event: "Request_supplied",
                        callback: (event, receipt) => {
                          const supplement = eib_guard.Request_supplied(event)
                          if (!request.req_id.equals(supplement.req_id)) {
                            return false
                          }
                          spellcheck_handle_receipt_events(sc_init,
                            Promise.resolve(cast<types.TransactionReceipt | null>(receipt)))
                          return true
                        }
                      }]
                    }]
                  )
                  return true
                }
              }]
            }],
            (found) => {
              if (!found) {
                return stop_with_error(true, "Could not find request announcement event.")
              }
            }
          )
          return true
        }
      }, {
        event: "Spellcheck_end",
        callback: (event, receipt) => {
          const sc_end = sc_guard.Spellcheck_end(event)
          if (!sc_init.sc_id.equals(sc_end.sc_id)) {
            return false
          }
          update_gas_used(receipt)
          show("checking_message", false)
          show(sc_end.valid ? "valid_message" : "invalid_message", true)
          const value_used = sc_init.value.minus(sc_end.unspent_value)
          set_text("value_used", window.web3.fromWei(value_used, "finney").toString())
          show("value_used_container", true)
          if (!sc_end.unspent_value.isZero()) {
            refund(sc_init)
          }
          return true
        }
      }]
    }],
    (found) => {
      if (!found) {
        return stop_with_error(true, "Could not find spellcheck update/end event.")
      }
    }
  )
}

/*====================================================================================================*/

function update_gas_used(receipt: types.TransactionReceipt): void {
  gas_used += receipt.gasUsed
  set_text("gas_used", gas_used.toString())
  show("gas_used_container", true)
}

/*====================================================================================================*/

function refund(sc_init: sc_interfaces.Spellcheck_init): void {
  (async () => {
    const gas_price = await eth.promisify(window.web3.eth.getGasPrice)
    const tx_hash = await eth.promisify<string>((callback) => window.sc.refund(
      sc_init.sc_id,
      {
        from: sc_init.requestor,
        gas: REFUND_GAS,
        gasPrice: gas_price
      },
      callback
    ))
    eth.handle_receipt_events(
      eth.promisify((callback) => window.web3.eth.getTransactionReceipt(tx_hash, callback)),
      [{
        abi: window.sc.abi,
        event_callbacks: [{
          event: "Spellcheck_refund",
          callback: (event) => {
            const sc_refund = sc_guard.Spellcheck_refund(event)
            if (!sc_init.sc_id.equals(sc_refund.sc_id)) {
              return false
            }
            set_text("value_refunded", window.web3.fromWei(sc_refund.value, "finney").toString())
            show("value_refunded_container", true)
            stop()
            return true
          }
        }]
      }],
      (found) => {
        if (!found) {
          return stop_with_error(true, "Could not find spellcheck refund event.")
        }
      }
    )
  })().catch((err) => {
    throw err
  })
}

/*====================================================================================================*/

function stop_with_error(internal: boolean, message: string): void {
  stop()
  alert((internal ? "Internal error: " : "" ) + message)
}

/*====================================================================================================*/

function stop(): void {
  (async () => {
    if (filter !== undefined) {
      await filter.stopWatching()
    }

    show("checking_message", false)

    enable("prompt_message", true)
    enable("word_label", true)
    enable("word", true)
    enable("value_label", true)
    enable("value", true)

    show("cancel_container", false)
    show("spellcheck_container", true)
  })().catch((err) => {
    throw err
  })
}

/*====================================================================================================*/

function cast<T>(x: any): T { return x as T }

/*====================================================================================================*/

function show(id: string, visible: boolean): void {
  cast<HTMLElement>(document.getElementById(id)).style.visibility = visible ? "visible" : "hidden"
}

/*====================================================================================================*/

function enable(id: string, enabled: boolean): void {
  const element = cast<HTMLElement>(document.getElementById(id))
  switch (element.tagName) {
    case "INPUT":
      cast<HTMLInputElement>(element).disabled = !enabled
      break
    default:
      element.style.color = enabled ? "initial" : "gray"
      break
  }
}

/*====================================================================================================*/

function set_text(id: string, value: string): void {
  cast<HTMLElement>(document.getElementById(id)).innerHTML = value.split("").map(escape).join("")
}

/*====================================================================================================*/

function escape(x: string): string {
  switch (x) {
    case " ": return "&nbsp;"
    case "&": return "&amp;"
    case "<": return "&lt;"
    case ">": return "&gt;"
    default:  return x
  }
}

/*====================================================================================================*/
