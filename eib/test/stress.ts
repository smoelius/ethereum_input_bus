/*====================================================================================================*
 * stress.ts
 *====================================================================================================*/

import assert from "assert"
import BN from "bn.js"
import * as conversion from "../../common/src/conversion"
import * as eth from "../../common/src/eth"
import { get_file_info } from "../../common/src/file_info"
import { guard } from "../../common/src/guard"
import * as interfaces from "../../common/src/interfaces"
import * as math from "../../common/src/math"
import * as merkle from "../../common/src/merkle"
import { none } from "../../common/src/promise"
import { handle_events_type, test } from "../../common/src/test"
import { generate_test_file } from "../../common/src/test_file"
import * as EIB from "../public/eib"

declare const it: (title: string, fn: () => Promise<any>) => void

/*====================================================================================================*/

const REQUEST_ETHER = new BN("10e15") // 10 milliether

const REQUEST_GAS = 300000
const SUPPLY_GAS  = 600000

/*====================================================================================================*/

test((context: interfaces.Test_context) => {

  /*==================================================================================================*/

  describe("stress tests", function(): void {
    this.timeout(10000) // 10 seconds

    const file = generate_test_file(5)

    const file_info = get_file_info(file)

    const ipfs_hash
      = conversion.uint256_from_ipfs_multihash("QmUJykqjgPY5Jj7NhLY8MoK2FW1aWapzAFooZe6NZCafbW")
    const file_length = file_info.file_length
    const merkle_root = file_info.merkle_tree[file_info.merkle_tree.length - 1]

    const file_addr = [ipfs_hash, new BN(file_length), merkle_root]

    before(async () => {
      const accounts = await context.web3.eth.getAccounts()
      assert(accounts.length > 0)
      context.web3.eth.defaultAccount = accounts[0]
    })

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
        it(title("should announce request", start, end), () =>
          context.web3.eth.sendTransaction({
            data: context.proxy.methods.request(
              EIB.FLAGS_NONE,
              EIB.IPFS_WITH_KECCAK256_MERKLE_ROOT,
              file_addr.map(conversion.to_hex),
              start,
              end,
              EIB.LTIOV_NONE,
              true,
              EIB.PROXY_CALLBACK_GAS_DEFAULT
            ).encodeABI(),
            to: context.proxy._address,
            value: REQUEST_ETHER.toString(),
            gas: REQUEST_GAS
          }).then(eth.handle_receipt_events(
            [{
              abi: context.Input_bus_artifacts.abi,
              event_callbacks: [{
                event: "Request_announced",
                callback: (event, receipt) => {
                  request = guard.Request_announced(event)
                  assert(conversion.bn_from_bignumber(request.file_addr_type)
                    .eqn(EIB.IPFS_WITH_KECCAK256_MERKLE_ROOT))
                  assert(conversion.json_equals(request.file_addr.map(conversion.bn_from_bignumber),
                    file_addr))
                  assert(conversion.bn_from_bignumber(request.start).eqn(start))
                  assert(conversion.bn_from_bignumber(request.end).eqn(end))
                  block_number = receipt.blockNumber
                  return Promise.resolve()
                }
              }]
            }]
          ))
        )
        if (!(context.options.external_supplier === true) && start < end) {
          assert(0 < proof.length)
          const data_length = end - start
          const data_first_negated = data.map((x, i) => i === 0 ? math.negate_bit_big(x, 255) : x)
          const data_last_negated = data.map((x, i) => i !== Math.floor((data_length - 1) / 32) ? x
            : math.negate_bit_big(x, (31 - ((data_length - 1) % 32)) * 8))
          const proof_first_negated = proof.map((x, i) => i === 0 ? math.negate_bit_big(x, 255) : x)
          const proof_last_negated = proof.map((x, i) => i !== proof.length - 1 ? x
            : math.negate_bit_big(x, 0))
          it(title("should fail to supply request with data first bit negated", start, end), () =>
            context.web3.eth.sendTransaction({
              data: context.eib.methods.supply(
                EIB.FLAGS_NONE,
                request.req_id.toString(),
                data_first_negated.map(conversion.to_hex),
                proof.map(conversion.to_hex)
              ).encodeABI(),
              to: context.eib._address,
              gas: SUPPLY_GAS
            }).invert().then(err =>
              assert(/.*\brevert$/.test(err.toString()))
            )
          )
          it(title("should fail to supply request with data last bit negated", start, end), () =>
            context.web3.eth.sendTransaction({
              data: context.eib.methods.supply(
                EIB.FLAGS_NONE,
                request.req_id.toString(),
                data_last_negated.map(conversion.to_hex),
                proof.map(conversion.to_hex)
              ).encodeABI(),
              to: context.eib._address,
              gas: SUPPLY_GAS
            }).invert().then(err =>
              assert(/.*\brevert$/.test(err.toString()))
            )
          )
          it(title("should fail to supply request with proof first bit negated", start, end), () =>
            context.web3.eth.sendTransaction({
              data: context.eib.methods.supply(
                EIB.FLAGS_NONE,
                request.req_id.toString(),
                data.map(conversion.to_hex),
                proof_first_negated.map(conversion.to_hex)
              ).encodeABI(),
              to: context.eib._address,
              gas: SUPPLY_GAS
            }).invert().then(err =>
              assert(/.*\brevert$/.test(err.toString()))
            )
          )
          it(title("should fail to supply request with proof last bit negated", start, end), () =>
            context.web3.eth.sendTransaction({
              data: context.eib.methods.supply(
                EIB.FLAGS_NONE,
                request.req_id.toString(),
                data.map(conversion.to_hex),
                proof_last_negated.map(conversion.to_hex)
              ).encodeABI(),
              to: context.eib._address,
              gas: SUPPLY_GAS
            }).invert().then(err =>
              assert(/.*\brevert$/.test(err.toString()))
            )
          )
          it(title("should fail to supply request with data and proof first bit negated", start, end),
              () =>
            context.web3.eth.sendTransaction({
              data: context.eib.methods.supply(
                EIB.FLAGS_NONE,
                request.req_id.toString(),
                data_first_negated.map(conversion.to_hex),
                proof_first_negated.map(conversion.to_hex)
              ).encodeABI(),
              to: context.eib._address,
              gas: SUPPLY_GAS
            }).invert().then(err =>
              assert(/.*\brevert$/.test(err.toString()))
            )
          )
          it(title("should fail to supply request with data and proof last bit negated", start, end),
              () =>
            context.web3.eth.sendTransaction({
              data: context.eib.methods.supply(
                EIB.FLAGS_NONE,
                request.req_id.toString(),
                data_last_negated.map(conversion.to_hex),
                proof_last_negated.map(conversion.to_hex)
              ).encodeABI(),
              to: context.eib._address,
              gas: SUPPLY_GAS
            }).invert().then(err =>
              assert(/.*\brevert$/.test(err.toString()))
            )
          )
        }
        it(title("should supply request", start, end), () => {
          const FLAG_SUPPLEMENT = 1
          const FLAG_CALLBACK   = 2
          let flags = 0
          function found(flag: number): Promise<void> {
            flags |= flag
            return flags === 3 ? Promise.resolve() : none()
          }
          return (context.handle_events as handle_events_type)(() => context.web3.eth.sendTransaction({
              data: context.eib.methods.supply(
                EIB.FLAGS_NONE,
                request.req_id.toString(),
                data.map(conversion.to_hex),
                proof.map(conversion.to_hex)
              ).encodeABI(),
              to: context.eib._address,
              gas: SUPPLY_GAS
            }),
            // smoelius: fromBlock is needed when the supplier is external.
            { fromBlock: block_number },
            [{
              abi: context.Input_bus_artifacts.abi,
              event_callbacks: [{
                event: "Request_supplied",
                callback: (event, receipt) => {
                  const supplement = guard.Request_supplied(event)
                  const callback_gas_used = conversion.bn_from_bignumber(supplement.callback_gas_before)
                    .sub(conversion.bn_from_bignumber(supplement.callback_gas_after))
                  assert(conversion.bn_from_bignumber(supplement.req_id)
                    .eq(conversion.bn_from_bignumber(request.req_id)))
                  assert(conversion.json_equals(supplement.data.map(context.web3.utils.toBN), data))
                  assert(conversion.json_equals(supplement.proof.map(context.web3.utils.toBN), proof))
                  if (!(context.options.external_supplier === true)
                      && (data.length !== 0 || proof.length !== 0)) {
                    console.error(`${data.length}\t${proof.length}`
                      + `\t${receipt.gasUsed || 0 - callback_gas_used.toNumber()}`
                      + `\t${callback_gas_used.toNumber()}`
                      + `\t${request.callback_gas}`
                    )
                  }
                  // smoelius: I have not figured out why, but when data and proof are empty, get_data
                  // and get_proof each use 71 less gas.
                  assert(data.length === 0 || proof.length === 0
                    || callback_gas_used.eq(conversion.bn_from_bignumber(request.callback_gas)))
                  return found(FLAG_SUPPLEMENT)
                }
              }]
            }, {
              abi: context.Proxy_requestor_artifacts.abi,
              event_callbacks: [{
                event: "Proxy_callback",
                callback: (event, receipt) => {
                  const callback = guard.Proxy_callback(event)
                  assert(conversion.bn_from_bignumber(callback.req_id)
                    .eq(conversion.bn_from_bignumber(request.req_id)))
                  assert(conversion.json_equals(callback.data.map(context.web3.utils.toBN), data))
                  assert(conversion.json_equals(callback.proof.map(context.web3.utils.toBN), proof))
                  // smoelius: The next statement is useful for calculating the gas costs of
                  // get_supplier, get_data, and get_data_proof.
                  /* if (!(context.options.external_supplier === true)) {
                    console.error(`${data.length}\t${proof.length}`
                      + `\t${callback.get_supplier_gas_before.minus(callback.get_supplier_gas_after)
                          .toNumber()}`
                      + `\t${callback.get_data_gas_before.minus(callback.get_data_gas_after)
                          .toNumber()}`
                      + `\t${callback.get_proof_gas_before.minus(callback.get_proof_gas_after)
                          .toNumber()}`
                      + `\t${callback.end_of_memory}`
                    )
                  } // */
                  return found(FLAG_CALLBACK)
                }
              }]
            }]
          )
        })
        it(title("should payout request", start, end), () =>
          (context.handle_events as handle_events_type)(() => context.web3.eth.sendTransaction({
              data: context.eib.methods.payout(
                EIB.FLAGS_NONE,
                request.req_id.toString(),
                EIB.PAYEE_DEFAULT
              ).encodeABI(),
              to: context.eib._address,
              gas: REQUEST_GAS
            }),
            { fromBlock: block_number },
            [{
              abi: context.Input_bus_artifacts.abi,
              event_callbacks: [{
                event: "Request_paidout",
                callback: (event, receipt) => {
                  const payment = guard.Request_paidout(event)
                  assert(conversion.bn_from_bignumber(payment.req_id)
                    .eq(conversion.bn_from_bignumber(request.req_id)))
                  assert(conversion.bn_from_bignumber(payment.value).eq(REQUEST_ETHER))
                  return Promise.resolve()
                }
              }]
            }]
          )
        )
        it(title("should have no response callbacks", start, end), async () =>
          assert(Object.keys((context.web3.currentProvider as any).responseCallbacks).length === 0)
        )
      }
    }

    after(() => {
      // smoelius: See:
      //   https://stackoverflow.com/questions/50632114/
      //     web3-websocket-connection-prevents-node-process-from-exiting
      //   https://ethereum.stackexchange.com/questions/50134/
      //     web3-websocket-connection-prevents-node-process-from-exiting
      (context.web3.currentProvider as any).connection.close()
    })
  })

  /*==================================================================================================*/

})

/*====================================================================================================*/

function title(base: string, start: number, end: number): string {
  return base + " (start = " + start + ", end = " + end + ")"
}

/*====================================================================================================*/
