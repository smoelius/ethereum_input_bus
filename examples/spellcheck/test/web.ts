/*====================================================================================================*
 * web.ts
 *====================================================================================================*/

import assert from "assert"
import BN from "bn.js"
import puppeteer from "puppeteer-core"
import Web3 from "web3"

declare const it: (title: string, fn: () => Promise<any>) => void

/*====================================================================================================*/

const chrome_path = process.env["CHROME_PATH"] || "/usr/bin/chromium-browser"

const SPELLCHECK_WEI = Web3.utils.toWei(new BN(10), "milliether")

let browser: puppeteer.Browser
let page: puppeteer.Page

/*====================================================================================================*/

describe("spellcheck tests", function(): void {
  this.timeout(60000) // 60 seconds

  before(async () => {
    browser = await puppeteer.launch({
      executablePath: chrome_path,
      headless: false
    })
    page = await browser.newPage()
    await page.goto("http://127.0.0.1:8000?test")
    // smoelius: Cause the page to use the entire window.  See:
    //   https://github.com/GoogleChrome/puppeteer/issues/1183#issuecomment-383722137
    await (page as any)._client.send("Emulation.clearDeviceMetricsOverride")
  })

  ; [
    [false, "&b"],
    [true,  "&c"],
    [false, "&d"],
    [false, "'c"],
    [true,  "'d"],
    [true,  "zyzzyva"],
    [false, "zyzzyvb"],
    [false, "zyzzyvar"],
    [true,  "zyzzyvas"],
    [false, "zyzzyvat"],
    [true,  "pneumonoultramicroscopicsilicovolcanoconiosis"],
    [false, "A".repeat(91)],
  ].forEach(p => test(p[0] as boolean, p[1] as string))

  after(async () => {
    await browser.close()
  })
})

/*====================================================================================================*/

function test(valid: boolean, word: string): void {
  it(`should spellcheck '${word}'`, () =>
    page.evaluate((
        word: string,
        value: string
    ) => {
      (document.getElementById("word") as HTMLInputElement).value = word
      ; (document.getElementById("value") as HTMLInputElement).value = value
      ; (document.getElementById("spellcheck") as HTMLButtonElement).click()
    }, word,
      Web3.utils.fromWei(SPELLCHECK_WEI, "milliether").toString()
    )
  )
  it("should show cancel button / hide spellcheck button", async () => {
    await page.waitForSelector("#cancel_container", { visible: true })
    assert(await page.evaluate(() =>
      (document.querySelector("#spellcheck_container") as HTMLElement).style.visibility) === "hidden")
    assert(await page.evaluate(() =>
      (document.querySelector("#checking_message") as HTMLElement).style.visibility) === "visible")
    assert(await page.evaluate(() =>
      (document.querySelector("#valid_message") as HTMLElement).style.visibility) === "hidden")
    assert(await page.evaluate(() =>
      (document.querySelector("#invalid_message") as HTMLElement).style.visibility) === "hidden")
    assert(await page.evaluate(() =>
      (document.querySelector("#value_refunded_container") as HTMLElement).style.visibility)
        === "hidden")
  })
  it("should show spellcheck button / hide cancel button", async () => {
    await page.waitForSelector("#spellcheck_container", { visible: true })
    assert(await page.evaluate(() =>
      (document.querySelector("#cancel_container") as HTMLElement).style.visibility) === "hidden")
    assert(await page.evaluate(() =>
      (document.querySelector("#checking_message") as HTMLElement).style.visibility) === "hidden")
  })
  it(`should indicate ${word} is ${valid ? "" : "NOT "}valid`, async () => {
    assert(await page.evaluate(() =>
      (document.querySelector("#valid_message") as HTMLElement).style.visibility)
        === valid ? "visible" : "hidden")
    assert(await page.evaluate(() =>
      (document.querySelector("#invalid_message") as HTMLElement).style.visibility)
        === valid ? "hidden" : "visible")
  })
  it(`should refund unspent value for '${word}'`, () =>
    page.waitForSelector("#value_refunded_container", { visible: true })
  )
}

/*====================================================================================================*/
