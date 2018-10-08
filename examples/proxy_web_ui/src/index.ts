/*====================================================================================================*
 * index.ts for EIB Proxy Web UI
 *====================================================================================================*/

import { BigNumber } from "bignumber.js"
import types = require("ethereum-types")
import Web3 from "web3"
import * as conversion from "../../../common/conversion"
import * as eth from "../../../common/eth"
import { guard } from "../../../common/guard"
import * as web from "../../../common/web"
import * as EIB from "../../../eib/public/eib"

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

const REQUEST_GAS = 300000

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
      return stop_with_error(true, "Unexpected number of networks.")
    }
    const network = Object.keys(Proxy_requestor_artifacts.networks)[0]
    web.reload_or_set("proxy_address", Proxy_requestor_artifacts.networks[network].address)
    web.reload_or_set("ipfs_multihash", "Qmd286K6pohQcTKYqnS1YhWrCiS4gz7Xi34sdwMe9USZ7u")
    web.reload_or_set("file_length", "443230")
    web.reload_or_set("merkle_root",
      "0x7854cdeeb3c1372d55cabba556c98b284fd7fa7f0df8ae787807d323cd33c10b")
    web.reload_or_set("start", "0")
    web.reload_or_set("end", "128")
    web.reload_or_set("value", "10")

    window.onbeforeunload = () => {
      web.save("proxy_address")
      web.save("ipfs_multihash")
      web.save("file_length")
      web.save("merkle_root")
      web.save("start")
      web.save("end")
      web.save("value")
    }
  })().catch((err) => {
    throw err
  })
})

window.addEventListener("keyup", (event) => {
  const request_container = web.as_get<HTMLElement>("request_container")
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

    const proxy_address = web.as_get<HTMLInputElement>("proxy_address").value
    if (proxy_address === "") {
      return stop_with_error(false, "Please specify Proxy address.")
    }
    const ipfs_hash = conversion.uint256_from_ipfs_multihash(
      web.as_get<HTMLInputElement>("ipfs_multihash").value)
    const file_length = web.as_get<HTMLInputElement>("file_length").value
    const merkle_root = web.as_get<HTMLInputElement>("merkle_root").value
    const start = web.as_get<HTMLInputElement>("start").value
    const end = web.as_get<HTMLInputElement>("end").value
    const value = window.web3.toWei(web.as_get<HTMLInputElement>("value").value, "finney")

    hex = ""
    ascii = []
    redisplay()

    web.show("request_container", false)
    web.show("cancel_container", true)

    /* tslint:disable variable-name */
    const Proxy_requestor = window.web3.eth.contract(Proxy_requestor_artifacts.abi)
    /* tslint:enable variable-name */

    const proxy = Proxy_requestor.at(proxy_address)

    const file_addr = [
      new BigNumber(ipfs_hash),
      new BigNumber(file_length),
      new BigNumber(merkle_root)
    ]

    const gas_price = await eth.promisify(window.web3.eth.getGasPrice)
    const tx_hash = await eth.promisify<string>((callback) => proxy.request(
      EIB.FLAGS_NONE,
      EIB.IPFS_WITH_KECCAK256_MERKLE_ROOT,
      file_addr,
      start,
      end,
      EIB.LTIOV_NONE,
      false,
      EIB.PROXY_CALLBACK_GAS_DEFAULT,
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
                && request.file_addr_type.equals(EIB.IPFS_WITH_KECCAK256_MERKLE_ROOT)
                && conversion.json_equals(request.file_addr, file_addr)
                && request.start.equals(start)
                && request.end.equals(end)
                && request.ltiov.equals(EIB.LTIOV_NONE)
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
                      .toString("ascii").split("").map(web.escape_char)
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
  const hex_elt = web.as_get<HTMLSpanElement>("hex")
  const ascii_elt = web.as_get<HTMLSpanElement>("ascii")
  hex_elt.innerHTML = ""
  ascii_elt.innerHTML = ""
  let cols = 0
  for (let start = 0; start < ascii.length; start += cols) {
    if (start === 0) {
      const ascii_container = web.as_get<HTMLDivElement>("ascii_container")
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

    web.show("cancel_container", false)
    web.show("request_container", true)
  })().catch((err) => {
    throw err
  })
}

/*====================================================================================================*/
