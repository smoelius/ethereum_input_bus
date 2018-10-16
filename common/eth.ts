/*====================================================================================================*
 * eth.ts
 *====================================================================================================*/

import assert from "assert"
import { logParser } from "ether-pudding"
import types = require("ethereum-types")
import Hasher from "js-sha3"
import Web3 from "web3"

/*====================================================================================================*/

// export const BLOCK_GAS_LIMIT = 4712388

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

export interface Abi_event_callback<T> {
  abi: any
  event_callbacks: Array<Event_callback<T>>
}

export interface Event_callback<T> {
  event: string
  callback: (event: any, receipt: types.TransactionReceipt) => T
}

/*====================================================================================================*/

export function selector(signature: string): number {
  return parseInt(Hasher.keccak256(signature).substr(0, 8), 16)
}

/*====================================================================================================*/

export function calculate_transaction_overhead(data: Buffer): number {
  return data.reduce((overhead, x) => {
    return overhead + (x === 0 ? G_TXDATAZERO : G_TXDATANONZERO)
  }, G_TRANSACTION)
}

/*====================================================================================================*/

export function handle_receipt_events(promised_receipt: Promise<types.TransactionReceipt | null>,
    abi_event_callbacks: Array<Abi_event_callback<boolean>>,
    assert = ((value: boolean) => { return })): void {
  (async () => {
    const receipt = await promised_receipt
    if (receipt === null) {
      return assert(false)
    }

    // console.log(JSON.stringify(receipt.logs))

    let found = false
    for (const abi_event_callback of abi_event_callbacks) {
      parse(receipt.logs, abi_event_callback.abi).forEach(log => {
        const event = log as types.DecodedLogEntry<any>
        for (const event_callback of abi_event_callback.event_callbacks) {
          if (event.event === event_callback.event) {
            found = found || event_callback.callback(event.args, receipt)
          }
        }
      })
    }

    assert(found)
  })().catch(err => {
    throw err
  })
}

/*====================================================================================================*/

export function handle_block_events(web3: Web3, filter_value: string | types.FilterObject,
    abi_event_callbacks: Array<Abi_event_callback<boolean>>): Web3.FilterResult {
  const filter = web3.eth.filter(filter_value)
  filter.watch((err, log) => {
    if (err) {
      throw err
    }
    for (const abi_event_callback of abi_event_callbacks) {
      parse([log], abi_event_callback.abi).forEach(log => {
        (async () => {
          const event = log as types.DecodedLogEntry<any>
          for (const event_callback of abi_event_callback.event_callbacks) {
            if (event.event === event_callback.event) {
              const receipt = await promisify<types.TransactionReceipt | null>(
                callback => web3.eth.getTransactionReceipt(log.transactionHash, callback))
              if (receipt === null) {
                return assert(false)
              }
              if (event_callback.callback(event.args, receipt)) {
                filter.stopWatching()
              }
            }
          }
        })().catch(err => {
          throw err
        })
      })
    }
  })
  return filter
}

/*====================================================================================================*/

export function parse(logs: types.LogEntry[], abi: types.ContractAbi):
    Array<types.LogEntry | types.DecodedLogEntry<any>> {
  // smoelius: logParser modifies the logs!!!
  return logs.map(log => log.hasOwnProperty("event") ? log : logParser([log], abi)[0])
}

/*====================================================================================================*
 * smoelius: "promisify" is adapted from 0xcaff's answer to:
 *   web3.js with promisified API
 *   https://ethereum.stackexchange.com/a/24238
 *====================================================================================================*/

export function promisify<T>(inner: (callback: (err: Error, result: T) => void) => void): Promise<T> {
  return new Promise<T>((resolve, reject) =>
    inner((err: Error, result: T) => {
      if (err) {
        reject(err)
      } else {
        resolve(result)
      }
    })
  )
}

/*====================================================================================================*/
