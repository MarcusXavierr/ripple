import { describe, expect, it } from "vitest"
import { urlToOriginPattern } from "./urlToOriginPattern"

describe("urlToOriginPattern", () => {
  it("returns https pattern for https URL", () => {
    expect(urlToOriginPattern("https://example.com/path")).toBe("https://example.com/*")
  })

  it("returns http pattern for http URL", () => {
    expect(urlToOriginPattern("http://example.com/")).toBe("http://example.com/*")
  })

  it("preserves port", () => {
    expect(urlToOriginPattern("http://localhost:3000/x")).toBe("http://localhost:3000/*")
  })

  it("ignores path, query, hash", () => {
    expect(urlToOriginPattern("https://a.test/b?c=1#d")).toBe("https://a.test/*")
  })

  it("returns null for chrome:// URL", () => {
    expect(urlToOriginPattern("chrome://extensions")).toBeNull()
  })

  it("returns null for file:// URL", () => {
    expect(urlToOriginPattern("file:///tmp/x.html")).toBeNull()
  })

  it("returns null for malformed URL", () => {
    expect(urlToOriginPattern("not a url")).toBeNull()
  })

  it("returns null for undefined", () => {
    expect(urlToOriginPattern(undefined)).toBeNull()
  })
})
