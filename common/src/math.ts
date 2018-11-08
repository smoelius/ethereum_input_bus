/*====================================================================================================*
 * math.ts
 *====================================================================================================*/

import assert from "assert"
import BN from "bn.js"

/*====================================================================================================*/

export function get_bit(x: number, i: number): boolean {
  return (x & (1 << i)) !== 0
}

export function get_bit_big(x: BN, i: number): boolean {
  return x.testn(i)
}

/*====================================================================================================*/

export function clear_bit(x: number, i: number): number {
  return x & ~(1 << i)
}

export function clear_bit_big(x: BN, i: number): BN {
  return !get_bit_big(x, i) ? x : x.sub(new BN(1).shln(i))
}

/*====================================================================================================*/

export function set_bit(x: number, i: number): number {
  return x | (1 << i)
}

export function set_bit_big(x: BN, i: number): BN {
  // smoelius: setn's type is broken---it actually has a second argument.
  // return x.setn(i)
  // smoelius: bincn modifies the object on which it is called!
  // return get_bit_big(x, i) ? x : x.bincn(i)
  return get_bit_big(x, i) ? x : x.add(new BN(1).shln(i))
}

/*====================================================================================================*/

export function negate_bit(x: number, i: number): number {
  return x ^ (1 << i)
}

export function negate_bit_big(x: BN, i: number): BN {
  return get_bit_big(x, i) ? clear_bit_big(x, i) : set_bit_big(x, i)
}

/*====================================================================================================*/

export function ceil_log2_big(x: BN): number {
  assert(x.gtn(0))
  x = x.subn(1)
  let e: number = 0
  while (x.gtn(0)) {
    x = x.shrn(1)
    e += 1
  }
  return e
}

/*====================================================================================================*/

export function ceil_div(x: number, y: number): number {
  return Math.floor((x + y - 1) / y)
}

export function ceil_div_big(x: BN, y: BN): BN {
  return x.add(y).subn(1).div(y)
}

/*====================================================================================================*/
