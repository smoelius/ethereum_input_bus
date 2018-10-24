/*====================================================================================================*
 * math.ts
 *====================================================================================================*/

import assert from "assert"
import { BigNumber } from "bignumber.js"

/*====================================================================================================*/

export function get_bit(x: number, i: number): boolean {
  return (x & (1 << i)) !== 0
}

export function get_bit_big(x: BigNumber, i: number): boolean {
  return !x.dividedToIntegerBy(new BigNumber(2).pow(i)).modulo(2).isZero()
}

/*====================================================================================================*/

export function clear_bit(x: number, i: number): number {
  return x & ~(1 << i)
}

export function clear_bit_big(x: BigNumber, i: number): BigNumber {
  return !get_bit_big(x, i) ? x : x.minus(new BigNumber(2).pow(i))
}

/*====================================================================================================*/

export function set_bit(x: number, i: number): number {
  return x | (1 << i)
}

export function set_bit_big(x: BigNumber, i: number): BigNumber {
  return get_bit_big(x, i) ? x : x.plus(new BigNumber(2).pow(i))
}

/*====================================================================================================*/

export function negate_bit(x: number, i: number): number {
  return x ^ (1 << i)
}

export function negate_bit_big(x: BigNumber, i: number): BigNumber {
  return get_bit_big(x, i) ? clear_bit_big(x, i) : set_bit_big(x, i)
}

/*====================================================================================================*/

export function ceil_log2_big(x: BigNumber): number {
  assert(x.gt(0))
  x = x.minus(1)
  let e: number = 0
  while (!x.isZero()) {
    x = x.dividedToIntegerBy(2)
    e += 1
  }
  return e
}

/*====================================================================================================*/

export function ceil_div(x: number, y: number): number {
  return Math.floor((x + y - 1) / y)
}

export function ceil_div_big(x: BigNumber, y: BigNumber): BigNumber {
  return x.plus(y).minus(1).dividedToIntegerBy(y)
}

/*====================================================================================================*/
