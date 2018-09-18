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
import * as web from "../../../common/web"
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
      return stop_with_error(true,
        "Unexpected number of networks (did you remember to deploy Spellcheck?).")
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

    web.set_text("ipfs_multihash", ipfs_multihash)
    web.set_text("file_length", file_addr[1].toString())
    web.set_text("file_gas", gas.toString())

    const request = new XMLHttpRequest()
    request.onreadystatechange = () => {
      if (request.readyState !== 4 || request.status !== 200) {
        return
      }
      const safe_low = JSON.parse(request.responseText).safeLow
      web.set_text("gas_rate", (safe_low / 10).toString())
      web.set_text("file_ether", gas.times(safe_low).dividedBy("10e9").toString())
    }
    request.open("GET", "https://ethgasstation.info/json/ethgasAPI.json", true)
    request.send()

    web.reload_or_set("word", "seigniorage")
    web.reload_or_set("value", "10")

    window.onbeforeunload = () => {
      web.save("word")
      web.save("value")
    }
  })().catch((err) => {
    throw err
  })
})

window.addEventListener("keyup", (event) => {
  const spellcheck_container = web.as_get<HTMLElement>("spellcheck_container")
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

    const word = web.as_get<HTMLInputElement>("word").value
    if (word === "") {
      return stop_with_error(false, "Please specify a word.")
    }
    const value = window.web3.toWei(web.as_get<HTMLInputElement>("value").value, "finney")

    web.show("checking_message", false)
    web.show("valid_message", false)
    web.show("invalid_message", false)
    web.show("gas_used_container", false)
    web.show("value_used_container", false)
    web.show("value_refunded_container", false)

    web.enable("prompt_message", false)
    web.enable("word_label", false)
    web.enable("word", false)
    web.enable("value_label", false)
    web.enable("value", false)

    web.set_text("checking_word", word)
    web.set_text("valid_word", word)
    web.set_text("invalid_word", word)

    web.show("checking_message", true)

    web.show("spellcheck_container", false)
    web.show("cancel_container", true)

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
    eth.handle_receipt_events(
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
            spellcheck_handle_receipt_events(sc_init, Promise.resolve(receipt))
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
  eth.handle_receipt_events(
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
                          spellcheck_handle_receipt_events(sc_init, Promise.resolve(receipt))
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
          web.show("checking_message", false)
          web.show(sc_end.valid ? "valid_message" : "invalid_message", true)
          const value_used = sc_init.value.minus(sc_end.unspent_value)
          web.set_text("value_used", window.web3.fromWei(value_used, "finney").toString())
          web.show("value_used_container", true)
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
  web.set_text("gas_used", gas_used.toString())
  web.show("gas_used_container", true)
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
            web.set_text("value_refunded", window.web3.fromWei(sc_refund.value, "finney").toString())
            web.show("value_refunded_container", true)
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

    web.show("checking_message", false)

    web.enable("prompt_message", true)
    web.enable("word_label", true)
    web.enable("word", true)
    web.enable("value_label", true)
    web.enable("value", true)

    web.show("cancel_container", false)
    web.show("spellcheck_container", true)
  })().catch((err) => {
    throw err
  })
}

/*====================================================================================================*/
