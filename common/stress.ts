/*====================================================================================================*
 * stress.ts
 *====================================================================================================*/

import assert from "assert"
import { BigNumber } from "bignumber.js"
import types = require("ethereum-types")
import * as conversion from "./conversion"
import * as eth from "./eth"
import { get_file_info } from "./file_info"
import { guard } from "./guard"
import * as interfaces from "./interfaces"
import * as math from "./math"
import * as merkle from "./merkle"
import { Test_context } from "./test"
import { generate_test_file } from "./test_file"

/*====================================================================================================*/

const CALLBACK_GAS =  30000
const REQUEST_GAS  = 300000
const SUPPLY_GAS   = 500000

/*====================================================================================================*/

export function stress(context: Test_context): void {

  /*==================================================================================================*/

  const file = generate_test_file(5)

  const file_info = get_file_info(file)

  /*==================================================================================================*/

  const ipfs_hash
    = conversion.uint256_from_ipfs_multihash("QmUJykqjgPY5Jj7NhLY8MoK2FW1aWapzAFooZe6NZCafbW")
  const file_length = file_info.file_length
  const merkle_root = file_info.merkle_tree[file_info.merkle_tree.length - 1]

  const file_addr = [ipfs_hash, new BigNumber(file_length), merkle_root]

  /*==================================================================================================*/

  describe("stress tests", function(): void {
    this.timeout(4000) // 4 seconds

    for (let start = 0; start <= file_info.file_length; start++) {
      if (start % 32 === 2) {
        start += 29
      }
      for (let end = start; end <= file_info.file_length; end++) {
        if (end % 32 === 2) {
          end += 29
        }
        const data = merkle.extract_data(file, start, end)
        const proof = merkle.extract_proof(start, end, file_info.file_length, file_info.merkle_tree)
        let block_number: number
        let request: interfaces.Request_announced
        it(title("should announce request", start, end), (done) => {
          const promised_receipt = eth.promisify<types.TransactionReceipt | null>(
            (callback) => context.web3.eth.getTransactionReceipt(context.proxy.request(
              0, // no flags
              0, // IPFS_WITH_KECCAK256_MERKLE_ROOT
              file_addr,
              start,
              end,
              0, // no ltiov
              2, // level 2
              CALLBACK_GAS,
              {
                value: "10e15", // 10 milliether
                gas: REQUEST_GAS
              }
            ),
            callback
          ))
          eth.handle_receipt_events(
            promised_receipt,
            [{
              abi: context.eib.abi,
              event_callbacks: [{
                event: "Request_announced",
                callback: (event, receipt) => {
                  request = guard.Request_announced(event)
                  assert(request.file_addr_type.equals(new BigNumber(0)))
                  assert(conversion.json_equals(request.file_addr, file_addr))
                  assert(request.start.equals(start))
                  assert(request.end.equals(end))
                  block_number = receipt.blockNumber
                  done()
                  return true
                }
              }]
            }],
            assert
          )
        })
        if (!(context.options.external_supplier === true) && start < end) {
          assert(0 < proof.length)
          const data_length = end - start
          const data_negated_first_bit = data.map((x, i) => i === 0 ? math.negate_bit(x, 255) : x)
          const data_negated_last_bit = data.map((x, i) => i !== Math.floor((data_length - 1) / 32) ? x
            : math.negate_bit(x, (31 - ((data_length - 1) % 32)) * 8))
          const proof_negated_first_bit = proof.map((x, i) => i === 0 ? math.negate_bit(x, 255) : x)
          const proof_negated_last_bit = proof.map((x, i) => i !== proof.length - 1 ? x
            : math.negate_bit(x, 0))
          console.log(`data:                    ${data.map((x) => x.toString(16))}`)
          console.log(`data_negated_first_bit:  ${data_negated_first_bit.map((x) => x.toString(16))}`)
          console.log(`data_negated_last_bit:   ${data_negated_last_bit.map((x) => x.toString(16))}`)
          console.log(`proof:                   ${proof.map((x) => x.toString(16))}`)
          console.log(`proof_negated_first_bit: ${proof_negated_first_bit.map((x) => x.toString(16))}`)
          console.log(`proof_negated_last_bit:  ${proof_negated_last_bit.map((x) => x.toString(16))}`)
          it(title("should fail to supply request with data first bit negated", start, end), (done) => {
            try {
              context.eib.supply(
                0, // no flags
                request.req_id,
                data_negated_first_bit,
                proof,
                { gas: SUPPLY_GAS }
              )
            } catch (err) {
              assert(/.*\brevert$/.test(err.toString()))
              done()
            }
          })
          it(title("should fail to supply request with data last bit negated", start, end), (done) => {
            try {
              context.eib.supply(
                0, // no flags
                request.req_id,
                data_negated_last_bit,
                proof,
                { gas: SUPPLY_GAS }
              )
            } catch (err) {
              assert(/.*\brevert$/.test(err.toString()))
              done()
            }
          })
          it(title("should fail to supply request with proof first bit negated", start, end),
              (done) => {
            try {
              context.eib.supply(
                0, // no flags
                request.req_id,
                data,
                proof_negated_first_bit,
                { gas: SUPPLY_GAS }
              )
            } catch (err) {
              assert(/.*\brevert$/.test(err.toString()))
              done()
            }
          })
          it(title("should fail to supply request with proof last bit negated", start, end), (done) => {
            try {
              context.eib.supply(
                0, // no flags
                request.req_id,
                data,
                proof_negated_last_bit,
                { gas: SUPPLY_GAS }
              )
            } catch (err) {
              assert(/.*\brevert$/.test(err.toString()))
              done()
            }
          })
          it(title("should fail to supply request with data and proof first bit negated", start, end),
              (done) => {
            try {
              context.eib.supply(
                0, // no flags
                request.req_id,
                data_negated_first_bit,
                proof_negated_first_bit,
                { gas: SUPPLY_GAS }
              )
            } catch (err) {
              assert(/.*\brevert$/.test(err.toString()))
              done()
            }
          })
          it(title("should fail to supply request with data and proof last bit negated", start, end),
              (done) => {
            try {
              context.eib.supply(
                0, // no flags
                request.req_id,
                data_negated_last_bit,
                proof_negated_last_bit,
                { gas: SUPPLY_GAS }
              )
            } catch (err) {
              assert(/.*\brevert$/.test(err.toString()))
              done()
            }
          })
        }
        it(title("should supply request", start, end), (done) => {
          let n_events_handled = 0
          const almost_done = () => {
            n_events_handled++
            if (n_events_handled < 2) {
              return false
            } else {
              assert(n_events_handled <= 2)
              done()
              return true
            }
          }
          context.handle_events(() => context.eib.supply(
              0, // no flags
              request.req_id,
              data,
              proof,
              { gas: SUPPLY_GAS }
            ),
            { fromBlock: block_number },
            [{
              abi: context.eib.abi,
              event_callbacks: [{
                event: "Request_supplied",
                callback: (event, receipt) => {
                  const supplement = guard.Request_supplied(event)
                  assert(supplement.req_id.equals(request.req_id))
                  assert(conversion.json_equals(supplement.data.map(conversion.to_bignumber), data))
                  assert(conversion.json_equals(supplement.proof.map(conversion.to_bignumber), proof))
                  if (!(context.options.external_supplier === true)
                      && (data.length !== 0 || proof.length !== 0)) {
                    const callback_gas_used
                      = supplement.callback_gas_start.minus(supplement.callback_gas_end).toNumber()
                    console.error(`${data.length}\t${proof.length}`
                      + `\t${receipt.gasUsed || 0 - callback_gas_used}`)
                  }
                  return almost_done()
                }
              }]
            }, {
              abi: context.proxy.abi,
              event_callbacks: [{
                event: "Proxy_callback",
                callback: (event, receipt) => {
                  const callback = guard.Proxy_callback(event)
                  assert(callback.req_id.equals(request.req_id))
                  assert(conversion.json_equals(callback.data, data))
                  assert(conversion.json_equals(callback.proof, proof))
                  return almost_done()
                }
              }]
            }]
          )
        })
        it(title("should payout request", start, end), (done) => {
          context.handle_events(() => context.eib.payout(
              0, // no flags
              request.req_id,
              0,  // default payee
              { gas: REQUEST_GAS }
            ),
            { fromBlock: block_number },
            [{
              abi: context.eib.abi,
              event_callbacks: [{
                event: "Request_paidout",
                callback: (event, receipt) => {
                  const payment = guard.Request_paidout(event)
                  assert(payment.req_id.equals(request.req_id))
                  assert(payment.value.equals("10e15"))
                  done()
                  return true
                }
              }]
            }]
          )
        })
      }
    }
  })

  /*==================================================================================================*/

}

/*====================================================================================================*/

function title(base: string, start: number, end: number): string {
  return base + " (start = " + start + ", end = " + end + ")"
}

/*====================================================================================================*/
