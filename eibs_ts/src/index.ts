/*====================================================================================================*
 * index.ts for prototype Ethereum Input Bus supplier
 *====================================================================================================*/

import assert from "assert"
// smoelius: BigNumber version 4.1.0 comes with a .d.ts file and seems to have an interface that is
// compatible with web3.
import { BigNumber } from "bignumber.js"
import chalk from "chalk"
import fs from "fs"
import IPFS from "ipfs"
import minimist from "minimist"
import Web3 from "web3"
import * as common from "../../common"
import { guard } from "./guard"
import * as interfaces from "./interfaces"

// From: http://mikemcl.github.io/bignumber.js/
// Almost never return exponential notation:
BigNumber.config({ EXPONENTIAL_AT: 1e+9 })

/*====================================================================================================*/

const EIBS_CONFIG = "eibs_config.json"

const DEFAULT_BUILD_PATH = "build"
const DEFAULT_CALIBRATION = [24080.023891, 24089.387372, 114298.527304]
const DEFAULT_GAS_CAP_ADJUSTMENT = 64 / 63
const DEFAULT_PROFIT = 2 // percent

const SUPPLY_SELECTOR = common.selector("supply(uint256,uint256,uint256[],uint256[])")
const UNSUPPLY_SELECTOR = common.selector("unsupply(uint256)")

const UNSUPPLY_SELECTION_GAS_COST = 427
const UNSUPPLY_INTRO_GAS_COST = 63 + common.C_JUMP
const UNSUPPLY_MAIN_GAS_COST = 40913 + common.C_JUMPDEST + 2 * common.G_SHA3WORD
  - common.G_SSET + common.G_SRESET - common.R_SCLEAR
  - common.G_SSET + common.G_SRESET
// smoelius: I am not sure that the next value is correct---it is my best guess.
const UNSUPPLY_MEMORY_GAS_COST = 3 * common.G_MEMORY

const UNSUPPLY_GAS_COST = UNSUPPLY_SELECTION_GAS_COST + UNSUPPLY_INTRO_GAS_COST + UNSUPPLY_MAIN_GAS_COST
  + UNSUPPLY_MEMORY_GAS_COST

const PAYOUT_GAS = 200000

/*====================================================================================================*/

log("eibs started.")

/*====================================================================================================*/

set_working_directory()

const preconfig = preconfigure()

const node = new IPFS({})

const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"))

if (preconfig.build_path === undefined) {
  preconfig.build_path = "build"
  log("build path unspecified---using '%s'.", preconfig.build_path)
}

const path = preconfig.build_path + "/contracts/Input_bus.json"
log("reading artifacts from '%s'.", path)
/* tslint:disable variable-name */
const Input_bus_artifacts = JSON.parse(fs.readFileSync(path).toString())
const Input_bus = web3.eth.contract(Input_bus_artifacts.abi)
/* tslint:enable variable-name */
log("'%s' read.", path)

if (preconfig.eib_address === undefined) {
  assert(Object.keys(Input_bus_artifacts.networks).length === 1)
  const network = Object.keys(Input_bus_artifacts.networks)[0]
  preconfig.eib_address = Input_bus_artifacts.networks[network].address
  log("eib address unspecified---using %s from artifacts.", preconfig.eib_address)
}

const eib = Input_bus.at(preconfig.eib_address || "")

if (preconfig.self_address === undefined) {
  assert(web3.eth.accounts.length >= 1)
  preconfig.self_address = web3.eth.defaultAccount = web3.eth.accounts[0]
  log("self address unspecified---using '%s'.", preconfig.self_address)
}

if (preconfig.payee_address === undefined) {
  if (!preconfig.debug_flag) {
    preconfig.payee_address = null
  } else {
    assert(web3.eth.accounts.length >= 2)
    preconfig.payee_address = web3.eth.defaultAccount = web3.eth.accounts[1]
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

const config = guard.Configuration(preconfig)

const mem_cache: { [key: string]: common.File_info; } = {}

let filter: Web3.FilterResult

/*====================================================================================================*/

node.on("ready", () => {
  filter = common.handle_block_events(
    web3,
    { fromBlock: "latest" },
    [{
      abi: eib.abi,
      event_callbacks: [{
        event: "Request_announced",
        callback: (event) => {
          const request = common.guard.Request_announced(event)
          log_event(chalk.bold.red, "Request_announced", request)
          const ipfs_hash = common.ipfs_multihash_from_uint256(request.file_addr[0])
          log("supplying request %d...", request.req_id)
          let data_length: number
          let proof_length: number
          let supply_gas_estimate: number
          if (config.model_flag) {
            data_length = common.calculate_data_length(request.file_addr[1].toNumber(),
              request.start.toNumber(), request.end.toNumber())
            proof_length = common.calculate_proof_length(request.start.toNumber(),
              request.end.toNumber(), request.file_addr[1].toNumber())
            supply_gas_estimate = model_estimate_supply_gas(data_length, proof_length)
            log("request %d supply gas estimate: %d", request.req_id, supply_gas_estimate)
          }
          node.files.cat(ipfs_hash, mem_cache_file_handler(ipfs_hash, (file, file_info) => {
            // smoelius: TODO: Verify that request still requires a response (i.e., has not been
            // canceled or already responded to).
            const data = common.extract_data(file, request.start.toNumber(), request.end.toNumber())
            const proof = common.extract_proof(request.start.toNumber(), request.end.toNumber(),
              file_info.file_length, file_info.merkle_tree)
            assert(data_length === undefined || data_length === data.length)
            assert(proof_length === undefined || proof_length === proof.length)
            if (supply_gas_estimate === undefined) {
              supply_gas_estimate = web3_estimate_supply_gas(data, proof, request)
              log("request %d supply gas estimate: %d", request.req_id, supply_gas_estimate)
              // const unsupply_gas_estimate = web3_estimate_unsupply_gas(request.req_id)
              // log("request %d unsupply gas estimate: %d", request.req_id, unsupply_gas_estimate)
            }
            const gas = Math.ceil((config.gas_cap_adjustment || 0)
              * (supply_gas_estimate + request.callback_gas.toNumber()))
            log("request %d gas: %d", request.req_id, gas)
            const gas_price = price_gas(gas, request.value)
            log("request %d gas price: %s Gwei", request.req_id, gas_price.dividedBy("10e9"))
            try {
              const receipt = web3.eth.getTransactionReceipt(eib.supply(
                0, // no flags
                request.req_id,
                data,
                proof,
                {
                  from: config.self_address,
                  gas: gas,
                  gasPrice : gas_price
                }
              ))
              if (receipt !== null) {
                log("request %s gas used: %d", request.req_id, receipt.gasUsed)
              }
              log("request %d supplied.", request.req_id)
            } catch (err) {
              log(err.toString())
            }
          }))
          return false
        }
      },

      {
        event: "Request_canceled",
        callback: (event) => {
          const cancellation = common.guard.Request_canceled(event)
          log_event(chalk.bold.yellow, "Request_canceled", cancellation)
          return false
        }
      },

      {
        event: "Request_supplied",
        callback: (event) => {
          const supplement = common.guard.Request_supplied(event)
          log_event(chalk.bold.green, "Request_supplied", supplement)
          log("request %d callback gas used: %d", supplement.req_id,
            supplement.callback_gas_start.minus(supplement.callback_gas_end).toNumber())
          if (config.payee_address
              && new BigNumber(supplement.supplier).equals(config.self_address || "")) {
            log("paying-out request %d...", supplement.req_id)
            try {
              eib.payout(
                0, // no flags
                supplement.req_id,
                config.payee_address,
                {
                  from: config.self_address,
                  gas: PAYOUT_GAS
                }
              )
              log("request %d paid-out.", supplement.req_id)
            } catch (err) {
              log(err.toString())
            }
          }
          return false
        }
      },

      {
        event: "Request_paidout",
        callback: (event) => {
          const payout = common.guard.Request_paidout(event)
          log_event(chalk.bold.magenta, "Request_paidout", payout)
          return false
        }
      }]
    }]
  )
})

/*====================================================================================================*/

function web3_estimate_supply_gas(data: BigNumber[], proof: BigNumber[],
    request: common.Request_announced): number {
  const supply_id = new Buffer(4)
  supply_id.writeUInt32BE(SUPPLY_SELECTOR, 0)
  const supply_call = Buffer.concat([
      supply_id,
      common.buffer_from_uint256(new BigNumber(1)), // FLAG_SUPPLY_SIMULATE
      common.buffer_from_uint256(request.req_id),
      common.buffer_from_uint256(new BigNumber(128)),
      common.buffer_from_uint256(new BigNumber(128 + (1 + data.length) * 32))
    ].concat([common.buffer_from_uint256(new BigNumber(data.length))])
    .concat(data.map(common.buffer_from_uint256))
    .concat([common.buffer_from_uint256(new BigNumber(proof.length))])
    .concat(proof.map(common.buffer_from_uint256))
  )
  const supply_gas_estimate = web3.eth.estimateGas({
    to: eib.address,
    data: supply_call.toString("hex"),
    from: config.self_address
  }) - common.G_TXDATANONZERO + common.G_TXDATAZERO - UNSUPPLY_GAS_COST
  return supply_gas_estimate
}

/*====================================================================================================*/

function web3_estimate_unsupply_gas(req_id: BigNumber): number {
  const unsupply_id = new Buffer(4)
  unsupply_id.writeUInt32BE(UNSUPPLY_SELECTOR, 0)
  const unsupply_call = Buffer.concat([
      unsupply_id,
      common.buffer_from_uint256(req_id)
  ])
  const unsupply_gas_estimate = web3.eth.estimateGas({
    to: eib.address,
    data: unsupply_call.toString("hex"),
    from: config.self_address
  }) - common.calculate_transaction_overhead(unsupply_call) - common.R_SCLEAR
  return unsupply_gas_estimate
}

/*====================================================================================================*/

function model_estimate_supply_gas(data_length: number, proof_length: number): number {
  const a = (config.calibration || [])[0]
  const b = (config.calibration || [])[1]
  const c = (config.calibration || [])[2]
  return a * data_length + b * proof_length + c
}

/*====================================================================================================*/

function price_gas(gas: number, value: BigNumber): BigNumber {
  return value.dividedBy(1 + (config.profit || 0) / 100).dividedToIntegerBy(gas)
}

/*====================================================================================================*/

function mem_cache_file_handler(ipfs_hash: string,
      file_info_callback: (file: Buffer, file_info: common.File_info) => void):
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
      file_info_callback: (file: Buffer, file_info: common.File_info) => void):
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
          merkle_tree: file_info.merkle_tree.map(common.to_bignumber)
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
      file_info_callback: (file: Buffer, file_info: common.File_info) => void):
    (err: NodeJS.ErrnoException, file: any) => void {
  return (err, file) => {
    if (err) {
      throw err
    }
    log("generating '%s' merkle tree...", ipfs_hash)
    const file_info = common.get_file_info(file)
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

function preconfigure(): interfaces.Preconfiguration {
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

  const preconfig: interfaces.Preconfiguration = {}

  for (const key in external_config) {
    switch (key) {
      case "_":
        switch (external_config[key].length) {
          case 0:
            break
          default:
            common.fail("extraneous argument: %s", external_config[key][0])
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
          common.fail("illegal argument to calibrate: %s", JSON.stringify(preconfig.calibration))
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
        common.warnx("unrecognized option: %s", key)
        console.error("Try '%s --help' for more information.", common.program_invocation_short_name)
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
    common.program_invocation_short_name,
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
