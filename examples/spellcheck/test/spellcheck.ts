/*====================================================================================================*
 * Spellcheck tests
 *====================================================================================================*/

import assert from "assert"
import { BigNumber } from "bignumber.js"
import types = require("ethereum-types")
import fs from "fs"
import Web3 from "web3"
import * as eth from "../../../common/src/eth"
import { guard as sc_guard } from "../src/guard"

/*====================================================================================================*/

const VERBOSE = true

const SPELLCHECK_GAS = 600000
const REFUND_GAS     = 300000

/*====================================================================================================*/

const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"))

web3.eth.defaultAccount = web3.eth.accounts[0]

/*====================================================================================================*/

/* tslint:disable variable-name */
const Input_bus_artifacts = JSON.parse(fs.readFileSync("eib_build/contracts/Input_bus.json").toString())
const Input_bus = web3.eth.contract(Input_bus_artifacts.abi)
/* tslint:enable variable-name */

assert(Object.keys(Input_bus_artifacts.networks).length === 1)
const network = Object.keys(Input_bus_artifacts.networks)[0]

const eib = Input_bus.at(Input_bus_artifacts.networks[network].address)

/*====================================================================================================*/

/* tslint:disable variable-name */
const Spellcheck_artifacts = JSON.parse(fs.readFileSync("build/contracts/Spellcheck.json").toString())
const Spellcheck = web3.eth.contract(Spellcheck_artifacts.abi)
/* tslint:enable variable-name */

assert(Object.keys(Spellcheck_artifacts.networks).length === 1)
assert(Object.keys(Spellcheck_artifacts.networks)[0] === network)

const sc = Spellcheck.at(Spellcheck_artifacts.networks[network].address)

/*====================================================================================================*/

describe("spellcheck tests", function(): void {
  this.timeout(60000); // 60 seconds

  [
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
})

/*====================================================================================================*/

function test(valid: boolean, word: string): void {
  let n_reqs: BigNumber = new BigNumber(0)
  let balance = new BigNumber(0)
  let sc_id: BigNumber
  let unspent_value: BigNumber
  it("should " + (valid ? "" : "NOT ") + "find \"" + word + "\"", done => {
    // smoelius: n_reqs and balance must be recorded inside the callback because there are no
    // guarantees as to when the callback will be called.
    n_reqs = sc.n_reqs()
    balance = web3.eth.getBalance(sc.address)
    const promised_receipt = eth.promisify<types.TransactionReceipt | null>(
      callback => web3.eth.getTransactionReceipt(sc.spellcheck(
        word,
        {
          value: "10e15", // 10 milliether
          gas: SPELLCHECK_GAS
        }
      ),
      callback
    ))
    eth.handle_receipt_events(
      promised_receipt,
      [{
        abi: sc.abi,
        event_callbacks: [{
          event: "Spellcheck_init",
          callback: (event, receipt) => {
            const sc_init = sc_guard.Spellcheck_init(event)
            if (sc_init.word !== word) {
              return false
            }
            if (VERBOSE) {
              console.log(JSON.stringify(sc_init))
            }
            sc_id = sc_init.sc_id
            eth.handle_block_events(
              web3,
              { fromBlock: receipt.blockNumber },
              [{
                abi: sc.abi,
                event_callbacks: [{
                  event: "Spellcheck_update",
                  callback: event => {
                    const sc_update = sc_guard.Spellcheck_update(event)
                    if (!sc_id.equals(sc_update.sc_id)) {
                      return false
                    }
                    if (VERBOSE) {
                      console.log(JSON.stringify(sc_update))
                    }
                    return false
                  }
                }, {
                  event: "Spellcheck_end",
                  callback: event => {
                    const sc_end = sc_guard.Spellcheck_end(event)
                    if (!sc_id.equals(sc_end.sc_id)) {
                      return false
                    }
                    if (VERBOSE) {
                      console.log(JSON.stringify(sc_end))
                    }
                    assert(sc_end.valid === valid)
                    unspent_value = sc_end.unspent_value
                    done()
                    return true
                  }
                }]
              }]
            )
            return true
          }
        }]
      }]
    )
  })
  it("should have returned to original number of requests (" + n_reqs + ")", done => {
    assert(sc.n_reqs().equals(n_reqs))
    done()
  })
  it("should refund unspent value for \"" + word + "\"", done => {
    const promised_receipt = eth.promisify<types.TransactionReceipt | null>(
      callback => web3.eth.getTransactionReceipt(sc.refund(
        sc_id,
        {
          gas: REFUND_GAS
        }
      ),
      callback
    ))
    eth.handle_receipt_events(
      promised_receipt,
      [{
        abi: sc.abi,
        event_callbacks: [{
          event: "Spellcheck_refund",
          callback: event => {
            const sc_refund = sc_guard.Spellcheck_refund(event)
            if (!sc_id.equals(sc_refund.sc_id)) {
              return false
            }
            assert(unspent_value.equals(sc_refund.value))
            done()
            return true
          }
        }]
      }]
    )
  })
  it("should have returned to original balance (" + balance + ")", done => {
    assert(web3.eth.getBalance(sc.address).equals(balance))
    done()
  })
}

/*====================================================================================================*/
