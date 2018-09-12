/*====================================================================================================*
 * index.ts for EIB Proxy Web UI
 *====================================================================================================*/

import { BigNumber } from "bignumber.js"
import types = require("ethereum-types")
import _ from "lodash"
import Web3 from "web3"
import * as conversion from "../../../common/conversion"
import * as eth from "../../../common/eth"
import { guard } from "../../../common/guard"

/*====================================================================================================*/

declare global {
  interface Window {
    web3: Web3
    request: () => void
    cancel: () => void
  }
}

declare const Input_bus_artifacts: any
declare const Proxy_requestor_artifacts: any

/*====================================================================================================*/

const CALLBACK_GAS =  30000
const REQUEST_GAS  = 300000

/*====================================================================================================*/

let filter: Web3.FilterResult
let hex: string
let ascii: string[]

/*====================================================================================================*/

window.request = request
window.stop = stop

/*====================================================================================================*/

window.addEventListener("load", () => {
  (async () => {
    if (typeof window.web3 === "undefined") {
      return stop_with_error(false, "EIB Hex Viewer requires MetaMask.")
    }
    window.web3 = new Web3(window.web3.currentProvider)

    if (Object.keys(Proxy_requestor_artifacts.networks).length !== 1) {
      throw new Error("Internal error: Unexpected number of networks.")
    }
    const network = Object.keys(Proxy_requestor_artifacts.networks)[0]
    cast<HTMLInputElement>(document.getElementById("proxy_address")).value
      = Proxy_requestor_artifacts.networks[network].address
  })().catch((err) => {
    throw err
  })
})

window.addEventListener("keyup", (event) => {
  const request_container = cast<HTMLElement>(document.getElementById("request_container"))
  if (event.keyCode === 13 && window.getComputedStyle(request_container).visibility === "visible") {
    request()
  }
})

window.addEventListener("resize", redisplay)

/*====================================================================================================*/

function request(): void {
  (async () => {
    const accounts = await eth.promisify(window.web3.eth.getAccounts)
    if (accounts.length <= 0) {
      return stop_with_error(false, "Please unlock MetaMask.")
    }

    const proxy_address = cast<HTMLInputElement>(document.getElementById("proxy_address")).value
    if (proxy_address === "") {
      return stop_with_error(false, "Please specify Proxy address.")
    }
    const ipfs_hash = conversion.uint256_from_ipfs_multihash(
      cast<HTMLInputElement>(document.getElementById("ipfs_multihash")).value)
    const file_length = cast<HTMLInputElement>(document.getElementById("file_length")).value
    const merkle_root = cast<HTMLInputElement>(document.getElementById("merkle_root")).value
    const start = cast<HTMLInputElement>(document.getElementById("start")).value
    const end = cast<HTMLInputElement>(document.getElementById("end")).value
    const value = window.web3.toWei(cast<HTMLInputElement>(document.getElementById("value")).value,
      "finney")

    hex = ""
    ascii = []
    redisplay()

    show("request_container", false)
    show("cancel_container", true)

    /* tslint:disable variable-name */
    const Proxy_requestor = window.web3.eth.contract(Proxy_requestor_artifacts.abi)
    /* tslint:enable variable-name */

    const proxy = Proxy_requestor.at(proxy_address)

    const file_addr = [
      ipfs_hash,
      file_length,
      merkle_root
    ]

    const gas_price = await eth.promisify(window.web3.eth.getGasPrice)
    const tx_hash = await eth.promisify<string>((callback) => proxy.request(
      0, // no flags
      0, // IPFS_WITH_KECCAK256_MERKLE_ROOT
      file_addr,
      start,
      end,
      0, // no ltiov
      0, // level 0
      CALLBACK_GAS,
      {
        from: accounts[0],
        value: value,
        gas: REQUEST_GAS,
        gasPrice: gas_price
      },
      callback
    ))
    eth.handle_receipt_events(
      eth.promisify<types.TransactionReceipt | null>(
        (callback) => window.web3.eth.getTransactionReceipt(tx_hash, callback)),
      [{
        abi: Input_bus_artifacts.abi,
        event_callbacks: [{
          event: "Request_announced",
          callback: (event, receipt) => {
            const request = guard.Request_announced(event)
            if (!(request.requestor === proxy_address
                && request.file_addr_type.equals(new BigNumber(0)) // smoelius: XXX: Define this.
                && _.isEqual(request.file_addr.map(toString), file_addr.map(toString))
                && request.start.equals(start)
                && request.end.equals(end)
                && request.ltiov.equals(new BigNumber(0))
                && request.callback_gas.equals(new BigNumber(CALLBACK_GAS))
                && request.value.equals(value))) {
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
                    const supplement = guard.Request_supplied(event)
                    if (!request.req_id.equals(supplement.req_id)) {
                      return false
                    }
                    const data = Buffer.concat(supplement.data.map(conversion.to_bignumber)
                      .map(conversion.buffer_from_uint256).slice(0, Number(end) - Number(start)))
                    hex = data.toString("hex").split("").map((x, i) => i % 2 === 0 ? x : x + " ")
                      .join("")
                    ascii = new Buffer(data.map((x) => x < 32 || x > 126 ? 46 /* '.' */ : x))
                      .toString("ascii").split("").map(escape)
                    redisplay()
                    stop()
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
  })().catch((err) => {
    throw err
  })
}

/*====================================================================================================*/

function redisplay(): void {
  const hex_elt = cast<HTMLSpanElement>(document.getElementById("hex"))
  const ascii_elt = cast<HTMLSpanElement>(document.getElementById("ascii"))
  hex_elt.innerHTML = ""
  ascii_elt.innerHTML = ""
  let cols = 0
  for (let start = 0; start < ascii.length; start += cols) {
    if (start === 0) {
      const ascii_container = cast<HTMLDivElement>(document.getElementById("ascii_container"))
      const width = ascii_container.clientWidth
      while (cols < ascii.length && ascii_elt.offsetWidth <= width) {
        ascii_elt.innerHTML += ascii[cols]
        cols++
      }
      if (cols > 0 && ascii_elt.offsetWidth > width) {
        cols--
        ascii_elt.innerHTML = ascii.slice(0, cols).join("")
      }
      hex_elt.innerHTML = hex.substring(0, 3 * cols)
      if (cols <= 0) {
        break
      }
    } else {
      hex_elt.innerHTML += "<br>" + hex.substring(3 * start, 3 * (start + cols))
      ascii_elt.innerHTML += "<br>" + ascii.slice(start, start + cols).join("")
    }
  }
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

    show("cancel_container", false)
    show("request_container", true)
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
