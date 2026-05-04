import { describe, expect, it } from "vitest"
import { derivePopupState } from "./derivePopupState"

const armedTab = {
  tabId: 42,
  windowId: 1,
  title: "Example",
  url: "https://example.com/page",
  origin: "https://example.com",
  selectedAt: 0,
  grantedPatterns: ["https://example.com/*"],
}

describe("derivePopupState", () => {
  it("idle when no armed tab", () => {
    const state = derivePopupState({
      stored: null,
      liveTab: null,
      hasPermission: false,
    })

    expect(state.kind).toBe("idle")
  })

  it("tabClosed when armed tab no longer resolves", () => {
    const state = derivePopupState({
      stored: armedTab,
      liveTab: { ok: false },
      hasPermission: true,
    })

    expect(state.kind).toBe("tabClosed")
  })

  it("controllable when wildcard grant covers a different live origin", () => {
    const state = derivePopupState({
      stored: armedTab,
      liveTab: { ok: true, url: "https://pt.example.com/", title: "Other" },
      hasPermission: true,
    })

    expect(state.kind).toBe("controllable")
  })

  it("pendingApproval when permission missing and origins match", () => {
    const state = derivePopupState({
      stored: armedTab,
      liveTab: { ok: true, url: "https://example.com/somewhere", title: "Example" },
      hasPermission: false,
    })

    expect(state.kind).toBe("pendingApproval")
  })

  it("permissionLost when permission missing and origin differs", () => {
    const state = derivePopupState({
      stored: armedTab,
      liveTab: { ok: true, url: "https://other.test/", title: "Other" },
      hasPermission: false,
    })

    expect(state.kind).toBe("permissionLost")
  })

  it("controllable when permission granted on same origin", () => {
    const state = derivePopupState({
      stored: armedTab,
      liveTab: { ok: true, url: "https://example.com/x", title: "Example" },
      hasPermission: true,
    })

    expect(state.kind).toBe("controllable")
  })
})
