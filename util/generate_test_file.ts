/*====================================================================================================*
 * generate_test_file.ts
 *====================================================================================================*/

import { generate_test_file, program_invocation_short_name } from "../common"

/*====================================================================================================*/

if (process.argv.length !== 3) {
  console.error("%s: expect one argument: number of 256-bit words to output",
    program_invocation_short_name)
  process.exit(1)
}

process.stdout.write(generate_test_file(Number(process.argv[2])))

/*====================================================================================================*/
