import { describe, expect, it, vi } from "vitest"
import { armedTabNavigationAction } from "./armedTabNavigationHandler"

const armed = {
  tabId: 42,
  windowId: 1,
  title: "Example",
  url: "https://wikipedia.org/",
  origin: "https://wikipedia.org",
  selectedAt: 0,
  grantedPatterns: ["https://wikipedia.org/*", "https://*.wikipedia.org/*"],
}

describe("armedTabNavigationAction", () => {
  it("noop when no armed tab", async () => {
    const contains = vi.fn()
    const action = await armedTabNavigationAction({
      armed: null,
      eventTabId: 42,
      changeUrl: "https://example.com/",
      status: "complete",
      contains,
    })
    expect(action).toEqual({ kind: "noop" })
    expect(contains).not.toHaveBeenCalled()
  })

  it("noop when event tabId differs", async () => {
    const action = await armedTabNavigationAction({
      armed,
      eventTabId: 99,
      changeUrl: "https://wikipedia.org/x",
      status: "complete",
      contains: vi.fn().mockResolvedValue(true),
    })
    expect(action).toEqual({ kind: "noop" })
  })

  it("noop when no URL change", async () => {
    const action = await armedTabNavigationAction({
      armed,
      eventTabId: 42,
      changeUrl: undefined,
      status: "complete",
      contains: vi.fn().mockResolvedValue(true),
    })
    expect(action).toEqual({ kind: "noop" })
  })

  it("noop when status is not loading or complete", async () => {
    const action = await armedTabNavigationAction({
      armed,
      eventTabId: 42,
      changeUrl: "https://wikipedia.org/x",
      status: undefined,
      contains: vi.fn().mockResolvedValue(true),
    })
    expect(action).toEqual({ kind: "noop" })
  })

  it("reinject when permissions.contains returns true (subdomain navigation)", async () => {
    const contains = vi.fn().mockResolvedValue(true)
    const action = await armedTabNavigationAction({
      armed,
      eventTabId: 42,
      changeUrl: "https://pt.wikipedia.org/x",
      status: "complete",
      contains,
    })
    expect(action).toEqual({ kind: "reinject", tabId: 42 })
    expect(contains).toHaveBeenCalledWith({ origins: ["https://pt.wikipedia.org/*"] })
  })

  it("permissionLost when permissions.contains returns false", async () => {
    const action = await armedTabNavigationAction({
      armed,
      eventTabId: 42,
      changeUrl: "https://example.com/",
      status: "complete",
      contains: vi.fn().mockResolvedValue(false),
    })
    expect(action).toEqual({ kind: "permissionLost", tabId: 42 })
  })

  it("permissionLost when URL is not http(s)", async () => {
    const action = await armedTabNavigationAction({
      armed,
      eventTabId: 42,
      changeUrl: "chrome://extensions",
      status: "complete",
      contains: vi.fn(),
    })
    expect(action).toEqual({ kind: "permissionLost", tabId: 42 })
  })
})
