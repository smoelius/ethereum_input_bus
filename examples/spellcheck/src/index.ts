/*====================================================================================================*
 * index.ts for Spellcheck
 *====================================================================================================*/

import BN from "bn.js"
import Web3 from "web3"
import * as web3_types from "web3/types"
import * as conversion from "../../../common/src/conversion"
import * as eth from "../../../common/src/eth"
import { guard as eib_guard } from "../../../common/src/guard"
import * as math from "../../../common/src/math"
import { none } from "../../../common/src/promise"
import * as web from "../../../common/src/web"
import Dict_artifacts from "../build/contracts/Dict.json"
import Spellcheck_artifacts from "../build/contracts/Spellcheck.json"
import Input_bus_artifacts from "../eib_build/contracts/Input_bus.json"
import * as sc_types from "../types/web3-contracts"
import { guard as sc_guard } from "./guard"
import * as sc_interfaces from "./interfaces"

/*====================================================================================================*/

declare global {
  interface Window {
    web3: Web3
    sc_address: string
    sc: sc_types.Spellcheck
    spellcheck: () => void
    cancel: () => void
  }
}

/*====================================================================================================*/

const SPELLCHECK_GAS = 600000
const REFUND_GAS     = 300000

/*====================================================================================================*/

let gas_used: number
let subscription: web3_types.Subscribe<web3_types.Log>

/*====================================================================================================*/

window.spellcheck = spellcheck
window.stop = stop

/*====================================================================================================*/

window.addEventListener("load", () => {
  (async () => {
    if (new URLSearchParams(window.location.search).has("test")) {
      window.web3 = new Web3(new Web3.providers.WebsocketProvider("ws://localhost:8545"))
    } else if (typeof window.web3 === "undefined") {
      return stop_with_error(false, "Spellcheck requires MetaMask.")
    } else {
      window.web3 = new Web3(window.web3.currentProvider)
    }

    if (Object.keys(Spellcheck_artifacts.networks).length !== 1) {
      return stop_with_error(true,
        "Unexpected number of networks (did you remember to deploy Spellcheck?).")
    }
    const network = Object.keys(Spellcheck_artifacts.networks)[0]
    window.sc_address = Spellcheck_artifacts.networks[network].address

    window.sc = new window.web3.eth.Contract(Spellcheck_artifacts.abi,
      window.sc_address) as sc_types.Spellcheck

    const dict_address = await window.sc.methods.dict().call()

    const dict = new window.web3.eth.Contract(Dict_artifacts.abi, dict_address) as sc_types.Dict

    const file_addr = await dict.methods.file_addr().call()

    const ipfs_multihash = conversion.ipfs_multihash_from_uint256(new BN(file_addr[0]))
    const gas = math.ceil_div_big(new BN(file_addr[1]), new BN(32)).muln(eth.G_SSET)

    web.set_text("ipfs_multihash", ipfs_multihash)
    web.set_text("file_length", file_addr[1].toString())
    web.set_text("file_gas", gas.toString())

    const request = new XMLHttpRequest()
    request.onreadystatechange = () => {
      if (request.readyState !== 4 || request.status !== 200) {
        return
      }
      const safe_low = JSON.parse(request.responseText).safeLow / 10 // gwei
      web.set_text("gas_rate", safe_low.toString())
      web.set_text("file_ether", window.web3.utils.fromWei(
        window.web3.utils.toWei(gas.muln(safe_low), "gwei"), "ether").toString())
    }
    request.open("GET", "https://ethgasstation.info/json/ethgasAPI.json", true)
    request.send()

    web.reload_or_set("word", "seigniorage")
    web.reload_or_set("value", "10")

    window.onbeforeunload = () => {
      web.save("word")
      web.save("value")
    }
  })().catch(err => {
    throw err
  })
})

window.addEventListener("keyup", event => {
  const spellcheck_container = web.as_get<HTMLElement>("spellcheck_container")
  if (event.keyCode === 13 && window.getComputedStyle(spellcheck_container).visibility === "visible") {
    spellcheck()
  }
})

/*====================================================================================================*/

function spellcheck(): void {
  (async () => {
    const accounts = await window.web3.eth.getAccounts()
    if (accounts.length <= 0) {
      return stop_with_error(false, "Please unlock MetaMask.")
    }

    const word = web.as_get<HTMLInputElement>("word").value
    if (word === "") {
      return stop_with_error(false, "Please specify a word.")
    }
    const value = window.web3.utils.toWei(web.as_get<HTMLInputElement>("value").value, "milliether")

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

    const gas_price = await window.web3.eth.getGasPrice()
    window.web3.eth.sendTransaction({
      data: window.sc.methods.spellcheck(
        word
      ).encodeABI(),
      from: accounts[0],
      to: window.sc._address,
      value: value,
      gas: SPELLCHECK_GAS,
      gasPrice: gas_price
    }).then(eth.handle_receipt_events(
      [{
        abi: Spellcheck_artifacts.abi,
        event_callbacks: [{
          event: "Spellcheck_init",
          callback: (event, receipt) => {
            const sc_init = sc_guard.Spellcheck_init(event)
            if (!(conversion.bn_from_hex(sc_init.requestor).eq(conversion.bn_from_hex(accounts[0]))
                && sc_init.word === word
                && conversion.bn_from_decimal(sc_init.value).eq(new BN(value)))) {
              return none<void>()
            }
            gas_used = 0
            return Promise.resolve(receipt)
              .then(spellcheck_handle_receipt_events(sc_init))
          }
        }]
      }]
    )).catch((err: any) => {
      console.log(err)
      stop_with_error(true, "Could not find spellcheck initiation event (see console for details).")
    })
  })().catch(err => {
    throw err
  })
}

/*====================================================================================================*/

function spellcheck_handle_receipt_events(sc_init: sc_interfaces.Spellcheck_init):
    (receipt: web3_types.TransactionReceipt) => Promise<void> {
  return receipt =>
    Promise.resolve(receipt)
    .then(eth.handle_receipt_events(
      [{
        abi: Spellcheck_artifacts.abi,
        event_callbacks: [{
          event: "Spellcheck_update",
          callback: (event, receipt) => {
            const sc_update = sc_guard.Spellcheck_update(event)
            if (!conversion.bn_from_decimal(sc_init.sc_id)
                .eq(conversion.bn_from_decimal(sc_update.sc_id))) {
              return none<void>()
            }
            update_gas_used(receipt)
            return Promise.resolve(receipt)
              .then(eth.handle_receipt_events(
                [{
                  abi: Input_bus_artifacts.abi,
                  event_callbacks: [{
                    event: "Request_announced",
                    callback: (event, receipt) => {
                      const request = eib_guard.Request_announced(event)
                      if (!(conversion.bn_from_hex(window.sc_address)
                            .eq(conversion.bn_from_hex(request.requestor))
                          && conversion.bn_from_decimal(sc_update.req_id)
                            .eq(conversion.bn_from_decimal(request.req_id)))) {
                        return none<void>()
                      }
                      const obj = eth.handle_block_events(
                        window.web3,
                        { fromBlock: receipt.blockNumber },
                        [{
                          abi: Input_bus_artifacts.abi,
                          event_callbacks: [{
                            event: "Request_supplied",
                            callback: (event, receipt) => {
                              const supplement = eib_guard.Request_supplied(event)
                              if (!conversion.bn_from_decimal(request.req_id)
                                  .eq(conversion.bn_from_decimal(supplement.req_id))) {
                                return none<void>()
                              }
                              return Promise.resolve(receipt)
                                .then(spellcheck_handle_receipt_events(sc_init))
                            }
                          }]
                        }]
                      )
                      subscription = eth.subscription_of(obj)
                      return eth.promise_of(obj)
                    }
                  }]
                }]
              )).catch(err => {
                console.log(err)
                stop_with_error(true,
                  "Could not find request announcement event (see console for details).")
              })
          }
        }, {
          event: "Spellcheck_end",
          callback: (event, receipt) => {
            const sc_end = sc_guard.Spellcheck_end(event)
            if (!conversion.bn_from_decimal(sc_init.sc_id)
                .eq(conversion.bn_from_decimal(sc_end.sc_id))) {
              return none<void>()
            }
            update_gas_used(receipt)
            web.show("checking_message", false)
            web.show(sc_end.valid ? "valid_message" : "invalid_message", true)
            const value_used = conversion.bn_from_decimal(sc_init.value)
              .sub(conversion.bn_from_decimal(sc_end.unspent_value))
            web.set_text("value_used",
              window.web3.utils.fromWei(value_used.toString(), "milliether").toString())
            web.show("value_used_container", true)
            if (conversion.bn_from_decimal(sc_end.unspent_value).gtn(0)) {
              return refund(sc_init)
            }
            return Promise.resolve()
          }
        }]
      }]
    )).catch(err => {
      console.log(err)
      stop_with_error(true, "Could not find spellcheck update/end event (see console for details).")
    })
}

/*====================================================================================================*/

function update_gas_used(receipt: web3_types.TransactionReceipt): void {
  gas_used += receipt.gasUsed
  web.set_text("gas_used", gas_used.toString())
  web.show("gas_used_container", true)
}

/*====================================================================================================*/

function refund(sc_init: sc_interfaces.Spellcheck_init): Promise<void> {
  return (async () => {
    const gas_price = await window.web3.eth.getGasPrice()
    return window.web3.eth.sendTransaction({
      data: window.sc.methods.refund(
        sc_init.sc_id.toString()
      ).encodeABI(),
      from: sc_init.requestor,
      to: window.sc._address,
      gas: REFUND_GAS,
      gasPrice: gas_price
    }).then(eth.handle_receipt_events(
      [{
        abi: Spellcheck_artifacts.abi,
        event_callbacks: [{
          event: "Spellcheck_refund",
          callback: event => {
            const sc_refund = sc_guard.Spellcheck_refund(event)
            if (!conversion.bn_from_decimal(sc_init.sc_id)
                .eq(conversion.bn_from_decimal(sc_refund.sc_id))) {
              return none<void>()
            }
            web.set_text("value_refunded",
              window.web3.utils.fromWei(sc_refund.value.toString(), "milliether").toString())
            web.show("value_refunded_container", true)
            stop()
            return Promise.resolve()
          }
        }]
      }]
    )).catch((err: any) => {
      console.log(err)
      stop_with_error(true, "Could not find spellcheck refund event (see console for details).")
    })
  })()
}

/*====================================================================================================*/

function stop_with_error(internal: boolean, message: string): void {
  stop()
  alert((internal ? "Internal error: " : "" ) + message)
}

/*====================================================================================================*/

function stop(): void {
  (async () => {
    if (subscription !== undefined) {
      // smoelius: @types/web3/types.d.ts's Subscribe type is broken.
      (subscription as any).unsubscribe()
    }

    web.show("checking_message", false)

    web.enable("prompt_message", true)
    web.enable("word_label", true)
    web.enable("word", true)
    web.enable("value_label", true)
    web.enable("value", true)

    web.show("cancel_container", false)
    web.show("spellcheck_container", true)
  })().catch(err => {
    throw err
  })
}

/*====================================================================================================*/
