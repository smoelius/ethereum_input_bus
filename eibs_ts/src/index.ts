/*====================================================================================================*
 * index.ts for prototype Ethereum Input Bus supplier
 *====================================================================================================*/

import assert from "assert"
import BN from "bn.js"
import chalk from "chalk"
import fs from "fs"
import IPFS from "ipfs"
import minimist from "minimist"
import Web3 from "web3"
import web3_types from "web3/types"
import * as conversion from "../../common/src/conversion"
import * as err from "../../common/src/err"
import * as eth from "../../common/src/eth"
import { get_file_info } from "../../common/src/file_info"
import { guard as eib_guard } from "../../common/src/guard"
import * as interfaces from "../../common/src/interfaces"
import * as merkle from "../../common/src/merkle"
import * as EIB from "../../eib/public/eib"
import * as eib_types from "../../eib/types/web3-contracts"
import { guard as config_guard } from "./guard"
import { Preconfiguration } from "./interfaces"

/*====================================================================================================*/

const EIBS_CONFIG = "eibs_config.json"

const DEFAULT_BUILD_PATH = "build"
const DEFAULT_CALIBRATION = [24080.023891, 24089.387372, 114298.527304]
const DEFAULT_GAS_CAP_ADJUSTMENT = 64 / 63
const DEFAULT_PROFIT = 2 // percent

const SUPPLY_SELECTOR = eth.selector("supply(uint256,uint256,uint256[],uint256[])")
const UNSUPPLY_SELECTOR = eth.selector("unsupply(uint256)")
const PAYOUT_SELECTOR = eth.selector("payout(uint256,uint256,address)")

const UNSUPPLY_SELECTION_GAS_COST = 427
const UNSUPPLY_INTRO_GAS_COST = 63 + eth.C_JUMP
const UNSUPPLY_MAIN_GAS_COST = 40913 + eth.C_JUMPDEST
  + 2 * eth.G_SHA3WORD
  - eth.G_SSET + eth.G_SRESET - eth.R_SCLEAR
  - eth.G_SSET + eth.G_SRESET
// smoelius: I am not sure that the next value is correct---it is my best guess.
const UNSUPPLY_MEMORY_GAS_COST = 3 * eth.G_MEMORY

const UNSUPPLY_GAS_COST =
    UNSUPPLY_SELECTION_GAS_COST
  + UNSUPPLY_INTRO_GAS_COST
  + UNSUPPLY_MAIN_GAS_COST
  + UNSUPPLY_MEMORY_GAS_COST

/*====================================================================================================*/

; (async () => {

/*====================================================================================================*/

log("eibs started.")

/*====================================================================================================*/

set_working_directory()

const preconfig = preconfigure()

const node = new IPFS({})

// smoelius: For why the use of websockets, see Adam Kipnis's answer to:
//   web3.eth.subscribe not implemented for web3 version 1.0.0-beta.27
//   https://stackoverflow.com/a/48174309
const web3 = new Web3(new Web3.providers.WebsocketProvider("ws://localhost:8545"))

if (preconfig.build_path === undefined) {
  preconfig.build_path = "build"
  log("build path unspecified---using '%s'.", preconfig.build_path)
}

const path = preconfig.build_path + "/contracts/Input_bus.json"
log("reading artifacts from '%s'.", path)
/* tslint:disable variable-name */
const Input_bus_artifacts = JSON.parse(fs.readFileSync(path).toString())
/* tslint:enable variable-name */
log("'%s' read.", path)

if (preconfig.eib_address === undefined) {
  assert(Object.keys(Input_bus_artifacts.networks).length === 1)
  const network = Object.keys(Input_bus_artifacts.networks)[0]
  preconfig.eib_address = Input_bus_artifacts.networks[network].address
  log("eib address unspecified---using %s from artifacts.", preconfig.eib_address)
}

const eib = new web3.eth.Contract(Input_bus_artifacts.abi,
  preconfig.eib_address || "") as eib_types.Input_bus

const accounts = await web3.eth.getAccounts()

if (preconfig.self_address === undefined) {
  assert(accounts.length >= 1)
  preconfig.self_address = accounts[0]
  log("self address unspecified---using '%s'.", preconfig.self_address)
}

if (preconfig.payee_address === undefined) {
  if (!preconfig.debug_flag) {
    preconfig.payee_address = null
  } else {
    assert(accounts.length >= 2)
    preconfig.payee_address = accounts[1]
    log("payee address unspecified---using '%s'.", preconfig.payee_address)
  }
}

if (preconfig.calibration === undefined) {
  preconfig.calibration = DEFAULT_CALIBRATION
  log("gas estimation parameters unspecified---using %s.", JSON.stringify(preconfig.calibration))
}

if (preconfig.gas_cap_adjustment === undefined) {
  preconfig.gas_cap_adjustment = DEFAULT_GAS_CAP_ADJUSTMENT
  log("gas cap adjustment unspecified---using %f.", preconfig.gas_cap_adjustment)
}

if (preconfig.profit === undefined) {
  preconfig.profit = DEFAULT_PROFIT
  log("profit unspecified---using %d.", preconfig.profit)
}

if (preconfig.disk_cache_path === undefined) {
  preconfig.disk_cache_path = null
} else {
  if (!fs.statSync(preconfig.disk_cache_path || "").isDirectory()) {
    throw new Error("'" + preconfig.disk_cache_path + "' is not a directory")
  }
  try {
    fs.accessSync(preconfig.disk_cache_path || "", fs.constants.W_OK)
  } catch (err) {
    throw new Error("'" + preconfig.disk_cache_path + "' is not writable")
  }
}

preconfig.debug_flag = preconfig.debug_flag || false
preconfig.model_flag = preconfig.model_flag || false
preconfig.mem_cache_flag = preconfig.mem_cache_flag || false

const config = config_guard.Configuration(preconfig)

const mem_cache: { [key: string]: interfaces.File_info; } = {}

let subscription: web3_types.Subscribe<web3_types.Log>

/*====================================================================================================*/

node.on("ready", async () => {
  subscription = eth.subscription_of(eth.handle_block_events(
    web3,
    // smoelius: Listening from the most recent block facilitates testing.
    { fromBlock: await web3.eth.getBlockNumber() },
    [{
      abi: Input_bus_artifacts.abi,
      event_callbacks: [{
        event: "Request_announced",
        callback: event => new Promise<void>((resolve, reject) => {
          const request = eib_guard.Request_announced(event)
          log_event(chalk.bold.red, "Request_announced", request)
          const ipfs_hash = conversion.ipfs_multihash_from_uint256(conversion.bn_from_bignumber(
            request.file_addr[0]))
          log("supplying request %d...", request.req_id)
          let data_length: number
          let proof_length: number
          let supply_gas_estimate: number
          if (config.model_flag) {
            data_length = merkle.calculate_data_length(
              conversion.bn_from_bignumber(request.file_addr[EIB.IPFSKEC256_FILE_LENGTH]).toNumber(),
              conversion.bn_from_bignumber(request.start).toNumber(),
              conversion.bn_from_bignumber(request.end).toNumber()
            )
            proof_length = merkle.calculate_proof_length(
              conversion.bn_from_bignumber(request.start).toNumber(),
              conversion.bn_from_bignumber(request.end).toNumber(),
              conversion.bn_from_bignumber(request.file_addr[EIB.IPFSKEC256_FILE_LENGTH]).toNumber()
            )
            supply_gas_estimate = model_estimate_supply_gas(data_length, proof_length)
            log("request %d supply excluding callback gas estimate: %d", request.req_id,
              supply_gas_estimate)
          }
          node.files.cat(ipfs_hash, mem_cache_file_handler(ipfs_hash, async (file, file_info) => {
            const data = merkle.extract_data(
              file,
              conversion.bn_from_bignumber(request.start).toNumber(),
              conversion.bn_from_bignumber(request.end).toNumber()
            )
            const proof = merkle.extract_proof(
              conversion.bn_from_bignumber(request.start).toNumber(),
              conversion.bn_from_bignumber(request.end).toNumber(),
              file_info.file_length,
              file_info.merkle_tree
            )
            assert(data_length === undefined || data_length === data.length)
            assert(proof_length === undefined || proof_length === proof.length)
            if (supply_gas_estimate === undefined) {
              supply_gas_estimate = await web3_estimate_supply_gas(
                conversion.bn_from_bignumber(request.req_id), data, proof)
              log("request %d supply excluding callback gas estimate: %d", request.req_id,
                supply_gas_estimate)
              // const unsupply_gas_estimate = web3_estimate_unsupply_gas(request.req_id)
              // log("request %d unsupply gas estimate: %d", request.req_id, unsupply_gas_estimate)
            }
            const gas = Math.ceil(config.gas_cap_adjustment
              * (supply_gas_estimate + conversion.bn_from_bignumber(request.callback_gas).toNumber()))
            log("request %d supply gas estimate: %d", request.req_id, gas)
            const gas_price = price_gas(gas, conversion.bn_from_bignumber(request.value))
            log("request %d supply gas price: %s Gwei", request.req_id,
              web3.utils.fromWei(gas_price.toString(), "gwei"))
            web3.eth.sendTransaction({
              data: eib.methods.supply(
                EIB.FLAGS_NONE,
                request.req_id.toString(),
                data.map(conversion.to_hex),
                proof.map(conversion.to_hex)
              ).encodeABI(),
              from: config.self_address,
              to: eib._address,
              gas: gas,
              gasPrice : gas_price.toString()
            }).then(receipt => {
              log("request %s supply gas used: %d", request.req_id, receipt.gasUsed)
              log("request %d supplied.", request.req_id)
            }).catch(err => {
              log(err.toString())
            })
          }))
        })
      },

      {
        event: "Request_canceled",
        callback: event => new Promise<void>((resolve, reject) => {
          const cancellation = eib_guard.Request_canceled(event)
          log_event(chalk.bold.yellow, "Request_canceled", cancellation)
        })
      },

      {
        event: "Request_supplied",
        callback: event => new Promise<void>(async (resolve, reject) => {
          const supplement = eib_guard.Request_supplied(event)
          log_event(chalk.bold.green, "Request_supplied", supplement)
          log("request %d callback gas used: %d", supplement.req_id,
            conversion.bn_from_bignumber(supplement.callback_gas_before)
              .sub(conversion.bn_from_bignumber(supplement.callback_gas_after)).toNumber())
          if (config.payee_address && web3.utils.toBN(supplement.supplier)
              .eq(web3.utils.toBN(config.self_address))) {
            log("paying-out request %d...", supplement.req_id)
            const payout_gas_estimate = await web3_estimate_payout_gas(conversion.bn_from_bignumber(
              supplement.req_id))
            log("request %d payout gas estimate: %d", supplement.req_id, payout_gas_estimate)
            web3.eth.sendTransaction({
              data: eib.methods.payout(
                EIB.FLAGS_NONE,
                supplement.req_id.toString(),
                config.payee_address
              ).encodeABI(),
              from: config.self_address,
              to: eib._address,
              gas: payout_gas_estimate
            }).then(receipt => {
              log("request %s payout gas used: %d", supplement.req_id, receipt.gasUsed)
              log("request %d paid-out.", supplement.req_id)
            }).catch(err => {
              log(err.toString())
            })
          }
        })
      },

      {
        event: "Request_paidout",
        callback: event => new Promise<void>((resolve, reject) => {
          const payout = eib_guard.Request_paidout(event)
          log_event(chalk.bold.magenta, "Request_paidout", payout)
        })
      }]
    }]
  ))
})

/*====================================================================================================*/

function web3_estimate_supply_gas(req_id: BN, data: BN[], proof: BN[]): Promise<number> {
  return (async () => await eib.methods.supply(
      EIB.FLAG_SUPPLY_SIMULATE,
      req_id.toString(),
      data.map(conversion.to_hex),
      proof.map(conversion.to_hex)
    ).estimateGas({
      from: config.self_address
    }) - eth.G_TXDATANONZERO + eth.G_TXDATAZERO // smoelius: For FLAG_SUPPLY_SIMULATE.
      - UNSUPPLY_GAS_COST
  )()
}

/*====================================================================================================*/

function web3_estimate_unsupply_gas(req_id: BN): Promise<number> {
  const unsupply_id = new Buffer(4)
  unsupply_id.writeUInt32BE(UNSUPPLY_SELECTOR, 0)
  const unsupply_call = Buffer.concat([
      unsupply_id,
      conversion.buffer_from_uint256(req_id)
  ])
  return (async () => await eib.methods.unsupply(
      req_id.toString()
    ).estimateGas({
      from: config.self_address
    }) - eth.calculate_transaction_overhead(unsupply_call) - eth.R_SCLEAR
  )()
}

/*====================================================================================================*/

function model_estimate_supply_gas(data_length: number, proof_length: number): number {
  const a = config.calibration[0]
  const b = config.calibration[1]
  const c = config.calibration[2]
  return a * data_length + b * proof_length + c
}

/*====================================================================================================*/

function price_gas(gas: number, value: BN): BN {
  return value.divn(gas * (1 + config.profit / 100))
}

/*====================================================================================================*/

/* smoelius: Expect the payout gas estimate to be much larger than the gas actually used.  Here is
  * Edmund Edgar's answer to:
  *   What are the limitations to estimateGas and when would its estimate be considerably wrong?
  *   https://ethereum.stackexchange.com/a/25896
  *
  *   One limitation (from my own observation, hopefully someone will correct me if I'm
  *   miunderstanding) is that even if estimateGas estimates correctly, that doesn't give you the gas
  *   limit that you need to set when sending your transaction.
  *
  *   The issue is that refunds are credited only at the end of the transaction, so if you have a
  *   transaction that does some work, and cleans up some storage as it goes, you need to set a high
  *   enough gas limit to do all the work without the benefit of the refund.
  *
  * Also note that, unlike supply, there is no "race" associated with payout.  Hence, there is no
  * need for an analogous model_estimate_payout_gas function.
  */

function web3_estimate_payout_gas(req_id: BN): Promise<number> {
  return eib.methods.payout(
    EIB.FLAGS_NONE,
    req_id.toString(),
    config.payee_address || ""
  ).estimateGas({
    from: config.self_address
  })
}

/*====================================================================================================*/

function mem_cache_file_handler(ipfs_hash: string,
      file_info_callback: (file: Buffer, file_info: interfaces.File_info) => void):
    (err: NodeJS.ErrnoException, file: any) => void {
  if (!(config.mem_cache_flag === true)) {
    return disk_cache_file_handler(ipfs_hash, file_info_callback)
  } else {
    return (err, file) => {
      if (err) {
        throw err
      }
      log("reading property mem_cache['%s']...", ipfs_hash)
      if (mem_cache[ipfs_hash] !== undefined) {
        const file_info = mem_cache[ipfs_hash]
        log("'%s' read.", ipfs_hash)
        file_info_callback(file, file_info)
      } else {
        log("mem_cache['%s'] does not exist.", ipfs_hash)
        disk_cache_file_handler(ipfs_hash, (file, file_info) => {
          log("writing property mem_cache['%s']...", ipfs_hash)
          mem_cache[ipfs_hash] = file_info
          log("mem_cache['%s'] written.", ipfs_hash)
          file_info_callback(file, file_info)
        })(err, file)
      }
    }
  }
}

/*====================================================================================================*/

function disk_cache_file_handler(ipfs_hash: string,
      file_info_callback: (file: Buffer, file_info: interfaces.File_info) => void):
    (err: NodeJS.ErrnoException, file: any) => void {
  if (!config.disk_cache_path) {
    return generic_file_handler(ipfs_hash, file_info_callback)
  } else {
    return (err, file) => {
      if (err) {
        throw err
      }
      const path = config.disk_cache_path + "/" + ipfs_hash
      try {
        log("reading local file '%s'...", path)
        const file_info = JSON.parse(fs.readFileSync(path).toString())
        log("'%s' read.", path)
        file_info_callback(file, {
          file_length: file_info.file_length,
          merkle_tree: file_info.merkle_tree.map(web3.utils.toBN)
        })
      } catch (read_err) {
        if (read_err.code === "ENOENT") {
          log("'%s' does not exist.", path)
          generic_file_handler(ipfs_hash, (file, file_info) => {
            log("writing local file '%s'...", path)
            fs.writeFile(path, JSON.stringify(file_info, null, "  "),
                (write_err: NodeJS.ErrnoException) => {
              if (write_err) {
                throw write_err
              }
              log("'%s' written.", path)
            })
            file_info_callback(file, file_info)
          })(err, file)
        } else {
          throw read_err
        }
      }
    }
  }
}

/*====================================================================================================*/

function generic_file_handler(ipfs_hash: string,
      file_info_callback: (file: Buffer, file_info: interfaces.File_info) => void):
    (err: NodeJS.ErrnoException, file: any) => void {
  return (err, file) => {
    if (err) {
      throw err
    }
    log("generating '%s' merkle tree...", ipfs_hash)
    const file_info = get_file_info(file)
    log("'%s' merkle tree generated.", ipfs_hash)
    file_info_callback(file, file_info)
  }
}

/*====================================================================================================*/

function set_working_directory(): void {
  log("reading environment variable 'EIBS_DIR'...")
  const eibs_dir = process.env["EIBS_DIR"]
  if (eibs_dir !== undefined) {
    log("'EIBS_DIR' read.")
  } else {
    log("'EIBS_DIR' does not exist.")
    return
  }

  log("setting working directory to '%s'...", eibs_dir)
  try {
    process.chdir(eibs_dir)
    log("'%s' set.", eibs_dir)
  } catch (err) {
    if (err.code === "ENOENT") {
      log("'%s' does not exist.", eibs_dir)
      process.exit(1)
    } else {
      throw err
    }
  }
}

/*====================================================================================================*/

function preconfigure(): Preconfiguration {
  let file_config: any = {}

  log("reading local file '%s'...", EIBS_CONFIG)
  try {
    file_config = JSON.parse(fs.readFileSync(EIBS_CONFIG).toString())
    log("'%s' read.", EIBS_CONFIG)
  } catch (err) {
    if (err.code === "ENOENT") {
      log("'%s' does not exist.", EIBS_CONFIG)
    } else {
      throw err
    }
  }

  const arg_config = minimist(process.argv.slice(2), {
    boolean: ["debug", "model", "mem-cache"],
    string: ["build", "eib", "self", "payee", "calibrate", "gas-cap-adjustment", "profit", "disk-cache"]
  })

  if (arg_config.hasOwnProperty("calibrate")) {
    arg_config.calibrate = JSON.parse(arg_config.calibrate)
  }

  const external_config = Object.assign(file_config, delete_false_properties(arg_config))

  const preconfig: Preconfiguration = {}

  for (const key in external_config) {
    switch (key) {
      case "_":
        switch (external_config[key].length) {
          case 0:
            break
          default:
            err.fail("extraneous argument: %s", external_config[key][0])
            break
        }
        break
      case "help":
        usage(0)
        break
      case "debug":
        preconfig.debug_flag = external_config[key]
        break
      case "build":
        preconfig.build_path = external_config[key]
        break
      case "eib":
        preconfig.eib_address = external_config[key]
        break
      case "self":
        preconfig.self_address = external_config[key]
        break
      case "payee":
        preconfig.payee_address = external_config[key]
        break
      case "model":
        preconfig.model_flag = external_config[key]
        break
      case "calibrate":
        preconfig.calibration = external_config[key]
        if ((preconfig.calibration || []).length !== 3) {
          err.fail("illegal argument to calibrate: %s", JSON.stringify(preconfig.calibration))
        }
        break
      case "gas-cap-adjustment":
        preconfig.gas_cap_adjustment = Number(external_config[key])
        break
      case "profit":
        preconfig.profit = Number(external_config[key])
        break
      case "disk-cache":
        preconfig.disk_cache_path = external_config[key]
        break
      case "mem-cache":
        preconfig.mem_cache_flag = external_config[key]
        break
      default:
        err.warnx("unrecognized option: %s", key)
        console.error("Try '%s --help' for more information.", err.program_invocation_short_name)
        process.exit(1)
    }
  }

  return preconfig
}

/*====================================================================================================*/

function delete_false_properties(obj: any): any {
  return Object.keys(obj).reduce((obj_new: any, key) => {
    if (!(obj[key] === false)) {
      obj_new[key] = obj[key]
    }
    return obj_new
  }, {})
}

/*====================================================================================================*/

function usage(code: number): void {
  console.log(
      "Usage: %s [OPTIONS]\n"
    + "Prototype Ethereum Input Bus supplier implemented in TypeScript.\n"
    + "  --help                   display this help text and exit\n"
    + "  --debug                  enable debugging\n"
    + "  --build PATH             specify eib build directory as PATH (default: '%s')\n"
    + "  --eib ADDRESS            specify eib address as ADDRESS\n"
    + "  --self ADDRESS           specify this supplier's own address as ADDRESS\n"
    + "  --payee ADDRESS          pay-out to ADDRESS\n"
    + "  --model                  estimate gas using a linear model instead of\n"
    + "                             web3.eth.estimateGas\n"
    + "  --calibrate '[A,B,C]'    calibrate gas estimation model using parameters [A,B,C];\n"
    + "                             note that Bash requires the argument to be quoted\n"
    + "                             (default: %s)\n"
    + "  --gas-cap-adjustement A  multiply gas estimate by A to account for gas cap\n"
    + "                             (default: %d)\n"
    + "  --profit N               require N% profit when supplying data (default: %d)\n"
    + "  --disk-cache PATH        enable disk cache at PATH\n"
    + "  --mem-cache              enable memory cache",
    err.program_invocation_short_name,
    DEFAULT_BUILD_PATH,
    JSON.stringify(DEFAULT_CALIBRATION),
    DEFAULT_GAS_CAP_ADJUSTMENT,
    DEFAULT_PROFIT
  )
  process.exit(code)
}

/*====================================================================================================*/

function log_event(style: (s: string) => string, name: string, event: any): void {
  _log(style, "eib says: %s %s.", name, JSON.stringify(event))
}

/*====================================================================================================*/

function log(message: string, ...optional_params: any[]): void {
  _log(chalk.reset, message, ...optional_params)
}

/*====================================================================================================*/

function _log(style: (s: string) => string, message: string, ...optional_params: any[]): void {
  console.log(style("%s: " + message), new Date().toString(), ...optional_params)
}

/*====================================================================================================*/

})() // async

/*====================================================================================================*/
