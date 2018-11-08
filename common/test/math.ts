/*====================================================================================================*
 * math.ts
 *====================================================================================================*/

import assert from "assert"
import BN from "bn.js"
import * as conversion from "../../common/src/conversion"
import { get_file_info } from "../../common/src/file_info"
import * as math from "../../common/src/math"
import * as merkle from "../../common/src/merkle"
import { generate_test_file } from "../../common/src/test_file"

declare const it: (title: string, fn: () => Promise<void>) => void

/*====================================================================================================*/

describe("bit operations", () => {
  const length = 30
  const ones = (1 << length) - 1
  it("get_bit(0, 0) === get_bit_big(new BN(0), 0)", async () => {
    assert(math.get_bit(0, 0) === math.get_bit_big(new BN(0), 0))
  })
  it(`get_bit(0, ${length - 1}) === get_bit_big(new BN(0), ${length - 1})`, async () => {
    assert(math.get_bit(0, length - 1) === math.get_bit_big(new BN(0), length - 1))
  })
  it("get_bit(ones, 0) === get_bit_big(new BN(ones), 0)", async () => {
    assert(math.get_bit(ones, 0) === math.get_bit_big(new BN(ones), 0))
  })
  it(`get_bit(ones, ${length - 1}) === get_bit_big(new BN(ones), ${length - 1})`, async () => {
    assert(math.get_bit(ones, length - 1) === math.get_bit_big(new BN(ones), length - 1))
  })
  it("new BN(clear_bit(0, 0)) === clear_bit_big(new BN(0), 0)", async () => {
    assert(new BN(math.clear_bit(0, 0)).eq(math.clear_bit_big(new BN(0), 0)))
  })
  it(`new BN(clear_bit(0, ${length - 1})) === clear_bit_big(new BN(0), ${length - 1})`, async () => {
    assert(new BN(math.clear_bit(0, length - 1)).eq(math.clear_bit_big(new BN(0), length - 1)))
  })
  it("new BN(clear_bit(ones, 0)) === clear_bit_big(new BN(ones), 0)", async () => {
    assert(new BN(math.clear_bit(ones, 0)).eq(math.clear_bit_big(new BN(ones), 0)))
  })
  it(`new BN(clear_bit(ones, ${length - 1})) === clear_bit_big(new BN(ones), ${length - 1})`,
      async () => {
    assert(new BN(math.clear_bit(ones, length - 1)).eq(math.clear_bit_big(new BN(ones), length - 1)))
  })
  it("new BN(set_bit(0, 0)) === set_bit_big(new BN(0), 0)", async () => {
    assert(new BN(math.set_bit(0, 0)).eq(math.set_bit_big(new BN(0), 0)))
  })
  it(`new BN(set_bit(0, ${length - 1})) === set_bit_big(new BN(0), ${length - 1})`, async () => {
    assert(new BN(math.set_bit(0, length - 1)).eq(math.set_bit_big(new BN(0), length - 1)))
  })
  it("new BN(set_bit(ones, 0)) === set_bit_big(new BN(ones), 0)", async () => {
    assert(new BN(math.set_bit(ones, 0)).eq(math.set_bit_big(new BN(ones), 0)))
  })
  it(`new BN(set_bit(ones, ${length - 1})) === set_bit_big(new BN(ones), ${length - 1})`, async () => {
    assert(new BN(math.set_bit(ones, length - 1)).eq(math.set_bit_big(new BN(ones), length - 1)))
  })
  it("new BN(negate_bit(0, 0)) === negate_bit_big(new BN(0), 0)", async () => {
    assert(new BN(math.negate_bit(0, 0)).eq(math.negate_bit_big(new BN(0), 0)))
  })
  it(`new BN(negate_bit(0, ${length - 1})) === negate_bit_big(new BN(0), ${length - 1})`, async () => {
    assert(new BN(math.negate_bit(0, length - 1)).eq(math.negate_bit_big(new BN(0), length - 1)))
  })
  it("new BN(negate_bit(ones, 0)) === negate_bit_big(new BN(ones), 0)", async () => {
    assert(new BN(math.negate_bit(ones, 0)).eq(math.negate_bit_big(new BN(ones), 0)))
  })
  it(`new BN(negate_bit(ones, ${length - 1})) === negate_bit_big(new BN(ones), ${length - 1})`,
      async () => {
    assert(new BN(math.negate_bit(ones, length - 1)).eq(math.negate_bit_big(new BN(ones), length - 1)))
  })
})

/*====================================================================================================*/

describe("bit operation stress tests", () => {
  // smoelius: These tests are motivated by the tests in eib/test/stress.ts.
  const file = generate_test_file(5)
  const file_info = get_file_info(file)
  for (let start = 0; start <= file_info.file_length; start++) {
    if (start % 32 === 2) {
      start += 29
    }
    for (let end = start; end <= file_info.file_length; end++) {
      if (end % 32 === 2) {
        end += 29
      }
      if (start >= end) {
        continue
      }
      const data = merkle.extract_data(file, start, end)
      const proof = merkle.extract_proof(start, end, file_info.file_length, file_info.merkle_tree)
      assert(0 < proof.length)
      const data_length = end - start
      const data_first_negated = data
        .map((x, i) => i === 0 ? math.negate_bit_big(x, 255) : x)
      const data_first_negated2 = data_first_negated
        .map((x, i) => i === 0 ? math.negate_bit_big(x, 255) : x)
      const data_last_negated = data
        .map((x, i) => i !== Math.floor((data_length - 1) / 32) ? x
          : math.negate_bit_big(x, (31 - ((data_length - 1) % 32)) * 8))
      const data_last_negated2 = data_last_negated
        .map((x, i) => i !== Math.floor((data_length - 1) / 32) ? x
          : math.negate_bit_big(x, (31 - ((data_length - 1) % 32)) * 8))
      const proof_first_negated = proof
        .map((x, i) => i === 0 ? math.negate_bit_big(x, 255) : x)
      const proof_first_negated2 = proof_first_negated
        .map((x, i) => i === 0 ? math.negate_bit_big(x, 255) : x)
      const proof_last_negated = proof
        .map((x, i) => i !== proof.length - 1 ? x : math.negate_bit_big(x, 0))
      const proof_last_negated2 = proof_last_negated
        .map((x, i) => i !== proof.length - 1 ? x : math.negate_bit_big(x, 0))
      /* console.log("start = %d, end = %d", start, end)
      console.log(`data:                ${data.map(x => x.toString(16))}`)
      console.log(`data_first_negated:  ${data_first_negated.map(x => x.toString(16))}`)
      console.log(`data_last_negated:   ${data_last_negated.map(x => x.toString(16))}`)
      console.log(`proof:               ${proof.map(x => x.toString(16))}`)
      console.log(`proof_first_negated: ${proof_first_negated.map(x => x.toString(16))}`)
      console.log(`proof_last_negated:  ${proof_last_negated.map(x => x.toString(16))}`)
      // */
      it(title("data !== data_first_negated", start, end), async () =>
        assert(!conversion.json_equals(data, data_first_negated))
      )
      it(title("data === data_first_negated2", start, end), async () =>
        assert(conversion.json_equals(data, data_first_negated2))
      )
      it(title("data !== data_last_negated", start, end), async () =>
        assert(!conversion.json_equals(data, data_last_negated))
      )
      it(title("data === data_last_negated2", start, end), async () =>
        assert(conversion.json_equals(data, data_last_negated2))
      )
      it(title("proof !== proof_first_negated", start, end), async () =>
        assert(!conversion.json_equals(proof, proof_first_negated))
      )
      it(title("proof === proof_first_negated2", start, end), async () =>
        assert(conversion.json_equals(proof, proof_first_negated2))
      )
      it(title("proof !== proof_last_negated", start, end), async () =>
        assert(!conversion.json_equals(proof, proof_last_negated))
      )
      it(title("proof === proof_last_negated2", start, end), async () =>
        assert(conversion.json_equals(proof, proof_last_negated2))
      )
    }
  }
})

/*====================================================================================================*/

function title(base: string, start: number, end: number): string {
  return base + " (start = " + start + ", end = " + end + ")"
}

/*====================================================================================================*/
