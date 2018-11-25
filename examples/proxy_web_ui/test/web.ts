/*====================================================================================================*
 * web.ts
 *====================================================================================================*/

import assert from "assert"
import BN from "bn.js"
import puppeteer from "puppeteer-core"
import Web3 from "web3"
import * as conversion from "../../../common/src/conversion"
import { get_file_info } from "../../../common/src/file_info"
import * as merkle from "../../../common/src/merkle"
import { generate_test_file } from "../../../common/src/test_file"

declare const it: (title: string, fn: () => Promise<any>) => void

/*====================================================================================================*/

const chrome_path = process.env["CHROME_PATH"] || "/usr/bin/chromium-browser"

const REQUEST_WEI = Web3.utils.toWei(new BN(10), "milliether")

/*====================================================================================================*/

describe("stress tests", function(): void {
  this.timeout(10000) // 10 seconds

  const file = generate_test_file(5)

  const file_info = get_file_info(file)

  const ipfs_multihash = "QmUJykqjgPY5Jj7NhLY8MoK2FW1aWapzAFooZe6NZCafbW"
  const file_length = file_info.file_length
  const merkle_root = file_info.merkle_tree[file_info.merkle_tree.length - 1]

  let browser: puppeteer.Browser
  let page: puppeteer.Page

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

  for (let start = 0; start <= file_info.file_length; start++) {
    if (start % 32 === 2) {
      start += 29
    }
    for (let end = start; end <= file_info.file_length; end++) {
      if (end % 32 === 2) {
        end += 29
      }
      const data = merkle.extract_data(file, start, end)
      it(title("should request", start, end), () =>
        page.evaluate((
            ipfs_multihash: string,
            file_length: string,
            merkle_root: string,
            start: string,
            end: string,
            value: string
        ) => {
          (document.getElementById("ipfs_multihash") as HTMLInputElement).value = ipfs_multihash
          ; (document.getElementById("file_length") as HTMLInputElement).value = file_length
          ; (document.getElementById("merkle_root") as HTMLInputElement).value = merkle_root
          ; (document.getElementById("start") as HTMLInputElement).value = start
          ; (document.getElementById("end") as HTMLInputElement).value = end
          ; (document.getElementById("value") as HTMLInputElement).value = value
          ; (document.getElementById("request") as HTMLButtonElement).click()
        }, ipfs_multihash,
          file_length.toString(),
          conversion.hex_from_bn(merkle_root),
          start.toString(),
          end.toString(),
          Web3.utils.fromWei(REQUEST_WEI, "milliether").toString()
        )
      )
      it(title("should show cancel button / hide request button", start, end), async () => {
        await page.waitForSelector("#cancel_container", { visible: true })
        assert(await page.evaluate(() =>
          (document.querySelector("#request_container") as HTMLElement).style.visibility) === "hidden")
      })
      it(title("should show request button / hide cancel button", start, end), async () => {
        await page.waitForSelector("#request_container", { visible: true })
        assert(await page.evaluate(() =>
          (document.querySelector("#cancel_container") as HTMLElement).style.visibility) === "hidden")
      })
      it(title("should have supplied request", start, end), async () => {
        let hex = ((await page.evaluate(() =>
            (document.querySelector("#hex") as HTMLSpanElement).innerHTML)) as string)
          .split("<br>").join("").split(" ").join("")
        assert(hex.length === 2 * (end - start))
        while (hex.length % 64 !== 0) {
          hex += "00"
        }
        assert(conversion.json_equals(data, (hex.match(/.{64}/g) || []).map(conversion.bn_from_hex)))
      })
    }
  }

  after(async () => {
    await browser.close()
  })
})

/*====================================================================================================*/

function title(base: string, start: number, end: number): string {
  return base + " (start = " + start + ", end = " + end + ")"
}

/*====================================================================================================*/
