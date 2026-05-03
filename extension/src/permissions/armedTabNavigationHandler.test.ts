import { describe, expect, it } from "vitest"
import { armedTabNavigationAction } from "./armedTabNavigationHandler"

const armed = {
  tabId: 42,
  windowId: 1,
  title: "Example",
  url: "https://example.com/x",
  origin: "https://example.com",
  selectedAt: 0,
}

describe("armedTabNavigationAction", () => {
  it("noop when no armed tab", () => {
    expect(
      armedTabNavigationAction({
        armed: null,
        eventTabId: 42,
        changeUrl: "https://example.com/y",
        status: "complete",
      })
    ).toEqual({ kind: "noop" })
  })

  it("noop when event tabId differs from armed tabId", () => {
    expect(
      armedTabNavigationAction({
        armed,
        eventTabId: 99,
        changeUrl: "https://example.com/y",
        status: "complete",
      })
    ).toEqual({ kind: "noop" })
  })

  it("reinject on same-origin URL change", () => {
    expect(
      armedTabNavigationAction({
        armed,
        eventTabId: 42,
        changeUrl: "https://example.com/another",
        status: "complete",
      })
    ).toEqual({ kind: "reinject", tabId: 42 })
  })

  it("permissionLost on cross-origin URL change", () => {
    expect(
      armedTabNavigationAction({
        armed,
        eventTabId: 42,
        changeUrl: "https://other.test/",
        status: "complete",
      })
    ).toEqual({ kind: "permissionLost", tabId: 42 })
  })

  it("noop when no URL change in event", () => {
    expect(
      armedTabNavigationAction({
        armed,
        eventTabId: 42,
        changeUrl: undefined,
        status: "complete",
      })
    ).toEqual({ kind: "noop" })
  })

  it("reinject when navigating back to armed origin from foreign origin", () => {
    expect(
      armedTabNavigationAction({
        armed,
        eventTabId: 42,
        changeUrl: "https://example.com/back",
        status: "complete",
      })
    ).toEqual({ kind: "reinject", tabId: 42 })
  })

  it("noop when status is not complete or loading", () => {
    expect(
      armedTabNavigationAction({
        armed,
        eventTabId: 42,
        changeUrl: "https://example.com/x",
        status: undefined,
      })
    ).toEqual({ kind: "noop" })
  })
})
