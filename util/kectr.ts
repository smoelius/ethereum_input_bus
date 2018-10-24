/*====================================================================================================*
 * kectr.ts
 *====================================================================================================*/

import assert from "assert"
import { BigNumber } from "bignumber.js"
import fs from "fs"
import minimist from "minimist"
import * as err from "../common/src/err"
import { get_file_info } from "../common/src/file_info"

// From: http://mikemcl.github.io/bignumber.js/
// Almost never return exponential notation:
BigNumber.config({ EXPONENTIAL_AT: 1e+9 })

/*====================================================================================================*/

enum Mode { json, root }

/*====================================================================================================*/

let mode: undefined | Mode = undefined
let path: undefined | string = undefined

const args = minimist(process.argv.slice(2), { boolean: [ "json", "root" ]})

for (const key in args) {
  switch (key) {
    case "_":
      switch (args[key].length) {
        case 0:
          break
        case 1:
          path = args[key][0]
          break
        default:
          err.fail("extraneous argument: %s", args[key][1])
          break
      }
      break
    case "help":
      usage(0)
      break
    case "json":
    case "root":
      if (args[key]) {
        if (mode !== undefined) {
          err.fail("at most one of --%s and --%s can be given", Mode[mode], key)
        }
        mode = Mode[key]
      }
      break
    default:
      err.warnx("unrecognized option: %s", key)
      console.error("Try '%s --help' for more information.", err.program_invocation_short_name)
      process.exit(1)
  }
}

mode = mode || Mode.json

let stream: ReadableStream | NodeJS.ReadableStream = process.stdin
if (path !== undefined) {
  stream = fs.createReadStream(path)
}

let file: Buffer = new Buffer(0)

stream.on("data", chunk => {
  file = Buffer.concat([file, chunk])
}).on("end", () => {
  const file_info = get_file_info(file)
  switch (mode) {
    case Mode.json:
      console.log(JSON.stringify(file_info, null, "  "))
      break
    case Mode.root:
      let merkle_root = new BigNumber(0)
      if (file_info.file_length >= 1) {
        merkle_root = file_info.merkle_tree[file_info.merkle_tree.length - 1]
      }
      console.log("0x%s", merkle_root.toString(16))
      break
    default:
      assert(false)
  }
})

/*====================================================================================================*/

function usage(code: number): void {
  console.log(
      "Usage: %s [OPTIONS] [PATH]\n"
    + "Generate Keccack-256 Merkle trees.\n"
    + "  --help  display this help text and exit\n"
    + "  --json  output Merkle tree in JSON format (default)\n"
    + "  --root  output Merkle root only",
    err.program_invocation_short_name
  )
  process.exit(code)
}

/*====================================================================================================*/
