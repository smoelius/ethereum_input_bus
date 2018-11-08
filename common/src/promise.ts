/*====================================================================================================*
 * promise.ts
 *====================================================================================================*/

/*====================================================================================================*
 * smoelius: "invert" is based on Ali Sahin Ozcelik's answer to:
 *   How to 'reverse' the rejection/fulfillment of a promise?
 *   https://stackoverflow.com/a/47451215
 *====================================================================================================*/

declare global {
  interface Promise<T> {
    invert(): Promise<any>
  }
}

Promise.prototype.invert = function(this): Promise<any> {
  return new Promise((resolve, reject) => this.then(reject).catch(resolve))
}

/*====================================================================================================*/

export function none<T>(): Promise<T> {
  return new Promise((resolve, reject) => { return })
}

/*====================================================================================================*/
