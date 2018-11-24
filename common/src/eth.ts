/*====================================================================================================*
 * eth.ts
 *====================================================================================================*/

import Hasher from "js-sha3"
import Web3 from "web3"
import * as web3_types from "web3/types"
import { none } from "./promise"

/*====================================================================================================*/

export const BLOCK_GAS_LIMIT = 4712388

export const G_MID           =     8
export const G_JUMPDEST      =     1
export const G_SSET          = 20000
export const G_SRESET        =  5000
export const R_SCLEAR        = 15000
export const G_MEMORY        =     3
export const G_TXDATAZERO    =     4
export const G_TXDATANONZERO =    68
export const G_TRANSACTION   = 21000
export const G_SHA3WORD      =     6

export const C_JUMP          = G_MID
export const C_JUMPDEST      = G_JUMPDEST

/*====================================================================================================*/

export type Tx_hash = string

/*====================================================================================================*/

export interface Abi_event_callback<T> {
  abi: any
  event_callbacks: Array<Event_callback<T>>
}

export interface Event_callback<T> {
  event: string
  callback: (event: any, receipt: web3_types.TransactionReceipt) => Promise<T>
}

export interface Subscription_promise<T> {
  _0: web3_types.Subscribe<web3_types.Log>
  _1: Promise<T>
}

export function subscription_of<T>(obj: Subscription_promise<T>):
  web3_types.Subscribe<web3_types.Log> { return obj._0 }

export function promise_of<T>(obj: Subscription_promise<T>): Promise<T> { return obj._1 }

/*====================================================================================================*/

/* tslint:disable variable-name */
const Web3_ = new Web3()
/* tslint:ensable variable-name */

/*====================================================================================================*/

export function selector(signature: string): string {
  return Web3_.eth.abi.encodeFunctionSignature(signature)
}

/*====================================================================================================*/

export function calculate_transaction_overhead(data: Buffer): number {
  return data.reduce((overhead, x) => {
    return overhead + (x === 0 ? G_TXDATAZERO : G_TXDATANONZERO)
  }, G_TRANSACTION)
}

/*====================================================================================================*/

export function handle_receipt_events<T>(abi_event_callbacks: Array<Abi_event_callback<T>>):
    (receipt: web3_types.TransactionReceipt) => Promise<T> {
  return receipt => {
    let result = none<T>()
    for (const abi_event_callback of abi_event_callbacks) {
      parse(receipt.logs || [], abi_event_callback.abi).forEach(event => {
        for (const event_callback of abi_event_callback.event_callbacks) {
          if (event.event === event_callback.event) {
            result = Promise.race([result, event_callback.callback(event.args, receipt)])
          }
        }
      })
    }
    return result
  }
}

/*====================================================================================================*/

export function handle_block_events<T>(web3: Web3, options: web3_types.Logs,
    abi_event_callbacks: Array<Abi_event_callback<T>>): Subscription_promise<T> {
  // smoelius: web3.eth.subscribe's type is broken.
  const subscription
    = web3.eth.subscribe("logs", options) as unknown as web3_types.Subscribe<web3_types.Log>
  return {
    _0: subscription,
    _1: new Promise((resolve, reject) => {
      subscription.on("data", log => {
        for (const abi_event_callback of abi_event_callbacks) {
          parse([log], abi_event_callback.abi).forEach(event => {
            for (const event_callback of abi_event_callback.event_callbacks) {
              if (event.event === event_callback.event) {
                Promise.resolve(log.transactionHash)
                .then(web3.eth.getTransactionReceipt)
                .then(receipt => event_callback.callback(event.args, receipt))
                .then(result => {
                  // smoelius: @types/web3/types.d.ts's Subscribe type is broken.
                  (subscription as any).unsubscribe((err: any, _: any) => {
                    if (err) {
                      reject(err)
                    } else {
                      resolve(result)
                    }
                  })
                })
              }
            }
          })
        }
      })
    })
  }
}

/*====================================================================================================*/

interface Decoded_log {
  transaction_hash: string
  event: string
  args: any
}

function parse(logs: web3_types.Log[], abi: any[]): Decoded_log[] {
  const decoders: { [topic: string]: (log: web3_types.Log) => Decoded_log } = abi
    .filter(obj => obj.type === "event")
    .reduce(
      (decoders: { [topic: string]: (log: web3_types.Log) => Decoded_log }, event) => {
        decoders[Web3_.eth.abi.encodeEventSignature(event)] = (log: web3_types.Log) => { return {
          transaction_hash: log.transactionHash,
          event: event.name as string,
          args: delete_array_like_properties(Web3_.eth.abi.decodeLog(event.inputs, log.data,
            log.topics.slice(1)))
        }}
        return decoders
      },
      {}
    )
  return logs
    .reduce(
      (decoded_logs: Decoded_log[], log) =>
        log.topics.length >= 1 && decoders[log.topics[0]] !== undefined
          ? decoded_logs.concat(decoders[log.topics[0]](log))
          : decoded_logs,
      []
    )
}

function delete_array_like_properties(obj: any): any {
  return Object.keys(obj)
    .reduce(
      (obj_new: any, key) => {
        if (!(/^[0-9]+$/.test(key) || key === "__length__")) {
          obj_new[key] = obj[key]
        }
        return obj_new
      },
      {}
    )
}

/*====================================================================================================*/
