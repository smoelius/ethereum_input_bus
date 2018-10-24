/*====================================================================================================*
 * generate_test_file.ts
 *====================================================================================================*/

import { program_invocation_short_name } from "../common/src/err"
import { generate_test_file } from "../common/src/test_file"

/*====================================================================================================*/

if (process.argv.length !== 3) {
  console.error("%s: expect one argument: number of 256-bit words to output",
    program_invocation_short_name)
  process.exit(1)
}

process.stdout.write(generate_test_file(Number(process.argv[2])))

/*====================================================================================================*/
