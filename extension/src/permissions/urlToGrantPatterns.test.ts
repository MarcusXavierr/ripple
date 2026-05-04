import { describe, expect, it } from "vitest"
import { canExpandSubdomains, urlToGrantPatterns } from "./urlToGrantPatterns"

describe("urlToGrantPatterns", () => {
  it("returns single pattern when includeSubdomains is false", () => {
    expect(urlToGrantPatterns("https://pt.wikipedia.org/wiki/X", false)).toEqual([
      "https://pt.wikipedia.org/*",
    ])
  })

  it("returns apex + wildcard pair for 2-label host", () => {
    expect(urlToGrantPatterns("https://wikipedia.org/", true)).toEqual([
      "https://wikipedia.org/*",
      "https://*.wikipedia.org/*",
    ])
  })

  it("strips first label for 3+ label host and returns apex + wildcard pair", () => {
    expect(urlToGrantPatterns("https://pt.wikipedia.org/x", true)).toEqual([
      "https://wikipedia.org/*",
      "https://*.wikipedia.org/*",
    ])
  })

  it("preserves http scheme", () => {
    expect(urlToGrantPatterns("http://example.test/", true)).toEqual([
      "http://example.test/*",
      "http://*.example.test/*",
    ])
  })

  it("returns single pattern for IPv4 literal even when includeSubdomains is true", () => {
    expect(urlToGrantPatterns("http://192.168.0.1/", true)).toEqual(["http://192.168.0.1/*"])
  })

  it("returns single pattern for IPv6 literal", () => {
    expect(urlToGrantPatterns("http://[::1]/", true)).toEqual(["http://[::1]/*"])
  })

  it("returns single pattern for single-label host", () => {
    expect(urlToGrantPatterns("http://localhost:3000/", true)).toEqual(["http://localhost:3000/*"])
  })

  it("returns null for non-http(s) URLs", () => {
    expect(urlToGrantPatterns("chrome://extensions", true)).toBeNull()
    expect(urlToGrantPatterns("file:///tmp/x", true)).toBeNull()
  })

  it("returns null for malformed URLs", () => {
    expect(urlToGrantPatterns("not a url", true)).toBeNull()
  })
})

describe("canExpandSubdomains", () => {
  it("true for multi-label http(s) host", () => {
    expect(canExpandSubdomains("https://wikipedia.org/")).toBe(true)
    expect(canExpandSubdomains("https://pt.wikipedia.org/")).toBe(true)
  })

  it("false for single-label host", () => {
    expect(canExpandSubdomains("http://localhost:3000/")).toBe(false)
  })

  it("false for IPv4 literal", () => {
    expect(canExpandSubdomains("http://192.168.0.1/")).toBe(false)
  })

  it("false for IPv6 literal", () => {
    expect(canExpandSubdomains("http://[::1]/")).toBe(false)
  })

  it("false for non-http(s)", () => {
    expect(canExpandSubdomains("chrome://extensions")).toBe(false)
  })

  it("false for malformed URL", () => {
    expect(canExpandSubdomains("not a url")).toBe(false)
  })
})
