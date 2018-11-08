/*====================================================================================================*
 * index.ts for EIB Proxy Web UI
 *====================================================================================================*/

import BN from "bn.js"
import Web3 from "web3"
import * as web3_types from "web3/types"
import * as conversion from "../../../common/src/conversion"
import * as eth from "../../../common/src/eth"
import { guard } from "../../../common/src/guard"
import { none } from "../../../common/src/promise"
import * as web from "../../../common/src/web"
import * as EIB from "../../../eib/public/eib"
import * as eib_types from "../../../eib/types/web3-contracts"
import Input_bus_artifacts from "../build/contracts/Input_bus.json"
import Proxy_requestor_artifacts from "../build/contracts/Proxy_requestor.json"

/*====================================================================================================*/

declare global {
  interface Window {
    web3: Web3
    request: () => void
    cancel: () => void
  }
}

/*====================================================================================================*/

const REQUEST_GAS = 300000

/*====================================================================================================*/

let subscription: web3_types.Subscribe<web3_types.Log>
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
  })().catch(err => {
    throw err
  })
})

window.addEventListener("keyup", event => {
  const request_container = web.as_get<HTMLElement>("request_container")
  if (event.keyCode === 13 && window.getComputedStyle(request_container).visibility === "visible") {
    request()
  }
})

window.addEventListener("resize", redisplay)

/*====================================================================================================*/

function request(): void {
  (async () => {
    const accounts = await window.web3.eth.getAccounts()
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
    const value = window.web3.utils.toWei(web.as_get<HTMLInputElement>("value").value, "finney")

    hex = ""
    ascii = []
    redisplay()

    web.show("request_container", false)
    web.show("cancel_container", true)

    const proxy = new window.web3.eth.Contract(Proxy_requestor_artifacts.abi,
      proxy_address) as eib_types.Proxy_requestor

    const file_addr = [
      ipfs_hash,
      new BN(file_length),
      window.web3.utils.toBN(merkle_root)
    ]

    const gas_price = await window.web3.eth.getGasPrice()
    window.web3.eth.sendTransaction({
      data: proxy.methods.request(
        EIB.FLAGS_NONE,
        EIB.IPFS_WITH_KECCAK256_MERKLE_ROOT,
        file_addr.map(conversion.to_hex),
        start,
        end,
        EIB.LTIOV_NONE,
        false,
        EIB.PROXY_CALLBACK_GAS_DEFAULT
      ).encodeABI(),
      from: accounts[0],
      to: proxy._address,
      value: value,
      gas: REQUEST_GAS,
      gasPrice: gas_price
    }).then(eth.handle_receipt_events(
      [{
        abi: Input_bus_artifacts.abi,
        event_callbacks: [{
          event: "Request_announced",
          callback: (event, receipt) => {
            const request = guard.Request_announced(event)
            if (!(window.web3.utils.toBN(request.requestor).eq(window.web3.utils.toBN(proxy_address))
                && conversion.bn_from_bignumber(request.file_addr_type)
                  .eqn(EIB.IPFS_WITH_KECCAK256_MERKLE_ROOT)
                && conversion.json_equals(request.file_addr.map(conversion.bn_from_bignumber),
                  file_addr)
                && conversion.bn_from_bignumber(request.start).eq(new BN(start))
                && conversion.bn_from_bignumber(request.end).eq(new BN(end))
                && conversion.bn_from_bignumber(request.ltiov).eqn(EIB.LTIOV_NONE)
                && conversion.bn_from_bignumber(request.value).eq(new BN(value)))) {
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
                    const supplement = guard.Request_supplied(event)
                    if (!conversion.bn_from_bignumber(request.req_id)
                        .eq(conversion.bn_from_bignumber(supplement.req_id))) {
                      return none<void>()
                    }
                    const data = Buffer.concat(supplement.data.map(window.web3.utils.toBN)
                      .map(conversion.buffer_from_uint256).slice(0, Number(end) - Number(start)))
                    hex = data.toString("hex").split("").map((x, i) => i % 2 === 0 ? x : x + " ")
                      .join("")
                    ascii = new Buffer(data.map(x => x < 32 || x > 126 ? 46 /* '.' */ : x))
                      .toString("ascii").split("").map(web.escape_char)
                    redisplay()
                    stop()
                    return Promise.resolve()
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
      stop_with_error(true, "Could not find request announcement event.")
    })
  })().catch(err => {
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
    if (subscription !== undefined) {
      // smoelius: @types/web3/types.d.ts's Subscribe type is broken.
      (subscription as any).unsubscribe()
    }

    web.show("cancel_container", false)
    web.show("request_container", true)
  })().catch(err => {
    throw err
  })
}

/*====================================================================================================*/
