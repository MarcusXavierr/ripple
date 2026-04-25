import { getIncompatibleTabReason, isControllableTabUrl } from "./isControllableTab"

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

  it("returns readable reasons for incompatible tabs", () => {
    expect(getIncompatibleTabReason("chrome://extensions")).toBe("Chrome internal pages cannot be controlled.")
    expect(getIncompatibleTabReason(undefined)).toBe("This tab has no controllable URL.")
  })
})
