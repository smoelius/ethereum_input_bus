/*====================================================================================================*
 * merkle.ts
 *====================================================================================================*/

import assert from "assert"
import { BigNumber } from "bignumber.js"
import Hasher from "js-sha3"
import * as conversion from "./conversion"
import * as math from "./math"

/*====================================================================================================*/

export function kec256_assemble_tree(height: number, offset: number, file: Buffer): BigNumber[] {
  const width = 2 ** height * 32
  if (height === 0) {
    return extract_data(file, offset, offset + 32)
  } else if (offset + width / 2 >= math.ceil_div(file.length, 32) * 32) {
    return kec256_assemble_tree(height - 1, offset, file)
  } else {
    const left = kec256_assemble_tree(height - 1, offset, file)
    const right = kec256_assemble_tree(height - 1, offset + width / 2, file)
    assert(left.length >= 1)
    assert(right.length >= 1)
    const root = new BigNumber(Hasher.keccak256(Buffer.concat([
      conversion.buffer_from_uint256(left[left.length - 1]),
      conversion.buffer_from_uint256(right[right.length - 1])
    ])), 16)
    return left.concat(right).concat([root])
  }
}

/*====================================================================================================*/

export function calculate_data_length(file_length: number, start: number, end: number): number {
  return math.ceil_div(end - start, 32)
}

export function extract_data(file: Buffer, start: number, end: number): BigNumber[] {
  let data = file.slice(start, end)
  const xs: BigNumber[] = []
  while (data.length > 0) {
    let buf = data.slice(0, 32)
    while (buf.length < 32) {
      buf = Buffer.concat([buf, new Buffer([0])])
    }
    xs.push(conversion.uint256_from_buffer(buf))
    data = data.slice(32)
  }
  return xs
}

/*====================================================================================================*/

export function calculate_proof_length(start: number, end: number, file_length: number): number {
  let proof_length = 0
  if (file_length > 0 && start < end) {
    const height = math.ceil_log2_big(math.ceil_div_big(new BigNumber(file_length), new BigNumber(32)))
    proof_length = _calculate_proof_length(height, 0, start, end, file_length)
  }
  return proof_length
}

function _calculate_proof_length(height: number, offset: number, start: number, end: number,
    file_length: number): number {
  const width = 2 ** height * 32
  if (height === 0) {
    return 1
  } else if (offset + width / 2 >= math.ceil_div(file_length, 32) * 32) {
    return _calculate_proof_length(height - 1, offset, start, end, file_length)
  } else {
    if (offset + width <= start || end <= offset) {
      return 1
    }
    const left_length = _calculate_proof_length(height - 1, offset, start, end, file_length)
    const right_length = _calculate_proof_length(height - 1, offset + width / 2, start, end,
      file_length)
    return left_length + right_length + 1
  }
}

export function extract_proof(start: number, end: number, file_length: number,
    merkle_tree: BigNumber[]): BigNumber[] {
  let proof: BigNumber[] = []
  if (file_length > 0 && start < end) {
    const height = math.ceil_log2_big(math.ceil_div_big(new BigNumber(file_length), new BigNumber(32)))
    let index: number
    [proof, index] = _extract_proof(height, 0, start, end, file_length, 0, merkle_tree)
    assert(index === merkle_tree.length - 1)
  }
  return proof
}

function _extract_proof(height: number, offset: number, start: number, end: number,
    file_length: number, tree_index: number, merkle_tree: BigNumber[]): [BigNumber[], number] {
  const width = 2 ** height * 32
  if (height === 0) {
    assert(tree_index < merkle_tree.length)
    return [[merkle_tree[tree_index]], tree_index]
  } else if (offset + width / 2 >= math.ceil_div(file_length, 32) * 32) {
    return _extract_proof(height - 1, offset, start, end, file_length, tree_index, merkle_tree)
  } else {
    if (offset + width <= start || end <= offset) {
      const root_index = tree_index + tree_size(height, offset, file_length) - 1
      assert(root_index < merkle_tree.length)
      return [[merkle_tree[root_index]], root_index]
    }
    const [left_proof, left_index] = _extract_proof(height - 1, offset, start, end, file_length,
      tree_index, merkle_tree)
    const [right_proof, right_index] = _extract_proof(height - 1, offset + width / 2, start, end,
      file_length, left_index + 1, merkle_tree)
    const root_index = right_index + 1
    assert(root_index < merkle_tree.length)
    return [left_proof.concat(right_proof).concat([merkle_tree[root_index]]), root_index]
  }
}

/*====================================================================================================*/

function tree_size(height: number, offset: number, file_length: number): number {
  assert(offset % 32 === 0)
  assert(offset < file_length)
  let size = 1
  for (; height > 0; height--) {
    const width = 2 ** (height - 1) * 32
    // smoelius: One node is counted implicitly, hence the "size = 1" above and the "- 1" just below.
    if (offset + width <= (math.ceil_div(file_length, 32) - 1) * 32) {
      size += 2 ** height // - 1 + 1
      offset += width
    }
  }
  return size
}

/*====================================================================================================*/
