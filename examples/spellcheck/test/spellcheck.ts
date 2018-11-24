/*====================================================================================================*
 * Spellcheck tests
 *====================================================================================================*/

import assert from "assert"
import BN from "bn.js"
import fs from "fs"
import Web3 from "web3"
import * as conversion from "../../../common/src/conversion"
import * as eth from "../../../common/src/eth"
import { none } from "../../../common/src/promise"
import { guard as sc_guard } from "../src/guard"
import * as sc_types from "../types/web3-contracts"

declare const it: (title: string, fn: () => Promise<void>) => void

/*====================================================================================================*/

const VERBOSE = true

const SPELLCHECK_WEI = Web3.utils.toWei(new BN(10), "milliether")

const SPELLCHECK_GAS = 600000
const REFUND_GAS     = 300000

/*====================================================================================================*/

// smoelius: For why the use of websockets, see Adam Kipnis's answer to:
//   web3.eth.subscribe not implemented for web3 version 1.0.0-beta.27
//   https://stackoverflow.com/a/48174309
const web3 = new Web3(new Web3.providers.WebsocketProvider("ws://localhost:8545"))

/*====================================================================================================*/

/* tslint:disable variable-name */
const Spellcheck_artifacts = JSON.parse(fs.readFileSync("build/contracts/Spellcheck.json").toString())
/* tslint:enable variable-name */

assert(Object.keys(Spellcheck_artifacts.networks).length === 1)
const network = Object.keys(Spellcheck_artifacts.networks)[0]

const sc = new web3.eth.Contract(Spellcheck_artifacts.abi,
  Spellcheck_artifacts.networks[network].address) as sc_types.Spellcheck

/*====================================================================================================*/

describe("spellcheck tests", function(): void {
  this.timeout(60000) // 60 seconds

  before(async () => {
    const accounts = await web3.eth.getAccounts()
    assert(accounts.length > 0)
    web3.eth.defaultAccount = accounts[0]
  })

  ; [
    [false, "&b"],
    [true,  "&c"],
    [false, "&d"],
    [false, "'c"],
    [true,  "'d"],
    [true,  "zyzzyva"],
    [false, "zyzzyvb"],
    [false, "zyzzyvar"],
    [true,  "zyzzyvas"],
    [false, "zyzzyvat"],
    [true,  "pneumonoultramicroscopicsilicovolcanoconiosis"],
    [false, "A".repeat(91)],
  ].forEach(p => test(p[0] as boolean, p[1] as string))

  after(() => {
    // smoelius: See:
    //   https://stackoverflow.com/questions/50632114/
    //     web3-websocket-connection-prevents-node-process-from-exiting
    //   https://ethereum.stackexchange.com/questions/50134/
    //     web3-websocket-connection-prevents-node-process-from-exiting
    (web3.currentProvider as any).connection.close()
  })
})

/*====================================================================================================*/

function test(valid: boolean, word: string): void {
  let n_reqs = new BN(0)
  let balance = new BN(0)
  let sc_id: BN
  let unspent_value: BN
  it("should " + (valid ? "" : "NOT ") + "find \"" + word + "\"", async () => {
    // smoelius: n_reqs and balance must be recorded inside the callback because there are no
    // guarantees as to when the callback will be called.
    n_reqs = new BN(await sc.methods.n_reqs().call())
    // smoelius: web3.eth.getBalance returns a string(?).
    balance = new BN(await web3.eth.getBalance(sc._address))
    return web3.eth.sendTransaction({
      data: sc.methods.spellcheck(
        word
      ).encodeABI(),
      to: sc._address,
      value: SPELLCHECK_WEI.toString(),
      gas: SPELLCHECK_GAS
    }).then(eth.handle_receipt_events(
      [{
        abi: Spellcheck_artifacts.abi,
        event_callbacks: [{
          event: "Spellcheck_init",
          callback: (event, receipt) => {
            const sc_init = sc_guard.Spellcheck_init(event)
            if (sc_init.word !== word) {
              return none<number>()
            }
            if (VERBOSE) {
              console.log(JSON.stringify(sc_init))
            }
            sc_id = conversion.bn_from_decimal(sc_init.sc_id)
            return Promise.resolve(receipt.blockNumber)
          }
        }]
      }]
    )).then((block_number: number) => eth.promise_of(eth.handle_block_events(
      web3,
      { fromBlock: block_number },
      [{
        abi: Spellcheck_artifacts.abi,
        event_callbacks: [{
          event: "Spellcheck_update",
          callback: event => {
            const sc_update = sc_guard.Spellcheck_update(event)
            if (!sc_id.eq(conversion.bn_from_decimal(sc_update.sc_id))) {
              return none<void>()
            }
            if (VERBOSE) {
              console.log(JSON.stringify(sc_update))
            }
            return none<void>()
          }
        }, {
          event: "Spellcheck_end",
          callback: event => {
            const sc_end = sc_guard.Spellcheck_end(event)
            if (!sc_id.eq(conversion.bn_from_decimal(sc_end.sc_id))) {
              return none<void>()
            }
            if (VERBOSE) {
              console.log(JSON.stringify(sc_end))
            }
            assert(sc_end.valid === valid)
            unspent_value = conversion.bn_from_decimal(sc_end.unspent_value)
            return Promise.resolve()
          }
        }]
      }]
    )))
  })
  it("should have returned to original number of requests (" + n_reqs + ")", async () =>
    assert(new BN(await sc.methods.n_reqs().call()).eq(n_reqs))
  )
  it("should refund unspent value for \"" + word + "\"", () =>
    web3.eth.sendTransaction({
      data: sc.methods.refund(
        sc_id.toString(),
      ).encodeABI(),
      to: sc._address,
      gas: REFUND_GAS
    }).then(eth.handle_receipt_events(
      [{
        abi: Spellcheck_artifacts.abi,
        event_callbacks: [{
          event: "Spellcheck_refund",
          callback: event => {
            const sc_refund = sc_guard.Spellcheck_refund(event)
            if (!sc_id.eq(conversion.bn_from_decimal(sc_refund.sc_id))) {
              return none<void>()
            }
            assert(unspent_value.eq(conversion.bn_from_decimal(sc_refund.value)))
            return Promise.resolve()
          }
        }]
      }]
    ))
  )
  it("should have returned to original balance (" + balance + ")", async () =>
    // smoelius: web3.eth.getBalance returns a string(?).
    assert(new BN(await web3.eth.getBalance(sc._address)).eq(balance))
  )
}

/*====================================================================================================*/
