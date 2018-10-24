/*====================================================================================================*
 * file_info.ts
 *====================================================================================================*/

import { BigNumber } from "bignumber.js"
import { File_info } from "./interfaces"
import * as math from "./math"
import * as merkle from "./merkle"

/*====================================================================================================*/

export function get_file_info(file: Buffer): File_info {
  let merkle_tree: BigNumber[] = []
  if (file.length > 0) {
    const height = math.ceil_log2_big(math.ceil_div_big(new BigNumber(file.length), new BigNumber(32)))
    merkle_tree = merkle.kec256_assemble_tree(height, 0, file)
  }
  return { file_length: file.length, merkle_tree: merkle_tree }
}

/*====================================================================================================*/
