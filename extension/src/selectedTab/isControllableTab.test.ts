import { getIncompatibleTabReasonKey, isControllableTabUrl } from "./isControllableTab"

describe("isControllableTabUrl", () => {
  it("accepts normal web pages", () => {
    expect(isControllableTabUrl("https://youtube.com/watch?v=1")).toBe(true)
    expect(isControllableTabUrl("http://localhost:3000/demo")).toBe(true)
  })

  it("rejects browser and extension pages", () => {
    expect(isControllableTabUrl("chrome://extensions")).toBe(false)
    expect(isControllableTabUrl("chrome-extension://abc/popup.html")).toBe(false)
    expect(isControllableTabUrl("about:blank")).toBe(false)
    expect(isControllableTabUrl("file:///tmp/demo.html")).toBe(false)
  })

  it("returns reason keys for incompatible tabs", () => {
    expect(getIncompatibleTabReasonKey("chrome://extensions")).toBe("reason_tab_chrome_internal")
    expect(getIncompatibleTabReasonKey(undefined)).toBe("reason_tab_no_controllable_url")
  })
})
