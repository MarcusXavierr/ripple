import { describe, expect, it } from "vitest"
import type { SelectedTab } from "../selectedTab/selectedTabStore"
import { derivePopupState } from "./derivePopupState"

const mkStored = (over: Partial<SelectedTab> = {}): SelectedTab => ({
  tabId: 42,
  windowId: 1,
  title: "Old title",
  url: "https://example.com/page",
  origin: "https://example.com",
  selectedAt: 0,
  ...over,
})

describe("derivePopupState", () => {
  it("state 1: no stored, current compatible", () => {
    const out = derivePopupState({
      stored: null,
      currentTab: { id: 7, title: "Now", url: "https://now.com" },
      liveLookup: null,
    })

    expect(out.card).toEqual({ kind: "empty" })
    expect(out.cta).toEqual({ kind: "use-current", enabled: true })
    expect(out.canClear).toBe(false)
  })

  it("state 2: no stored, current incompatible", () => {
    const out = derivePopupState({
      stored: null,
      currentTab: { id: 7, title: "Settings", url: "chrome://settings" },
      liveLookup: null,
    })

    expect(out.card.kind).toBe("empty")
    expect(out.cta.kind).toBe("use-current")
    if (out.cta.kind === "use-current") {
      expect(out.cta.enabled).toBe(false)
      expect(out.cta.reason).toBeTruthy()
    }
  })

  it("state 3: stored differs from current, both compatible — uses live title", () => {
    const out = derivePopupState({
      stored: mkStored({ tabId: 42, title: "Old title" }),
      currentTab: { id: 7, title: "Now", url: "https://now.com" },
      liveLookup: { ok: true, title: "Live title", url: "https://example.com/page" },
    })

    expect(out.card).toEqual({
      kind: "selected",
      title: "Live title",
      origin: "https://example.com",
    })
    expect(out.cta).toEqual({ kind: "use-current", enabled: true })
    expect(out.canClear).toBe(true)
  })

  it("state 5: stored equals current — already-selected CTA", () => {
    const out = derivePopupState({
      stored: mkStored({ tabId: 42 }),
      currentTab: { id: 42, title: "Live title", url: "https://example.com/page" },
      liveLookup: { ok: true, title: "Live title", url: "https://example.com/page" },
    })

    expect(out.card.kind).toBe("selected-is-current")
    expect(out.cta).toEqual({ kind: "already-selected" })
    expect(out.canClear).toBe(true)
  })

  it("state 6a: stored tab was closed", () => {
    const out = derivePopupState({
      stored: mkStored({ title: "Old title" }),
      currentTab: { id: 7, title: "Now", url: "https://now.com" },
      liveLookup: { ok: false, reason: "closed" },
    })

    expect(out.card).toEqual({
      kind: "stale-closed",
      title: "Old title",
      origin: "https://example.com",
    })
    expect(out.canClear).toBe(true)
  })

  it("state 6b: stored tab navigated to incompatible URL", () => {
    const out = derivePopupState({
      stored: mkStored(),
      currentTab: { id: 7, title: "Now", url: "https://now.com" },
      liveLookup: { ok: true, title: "Settings", url: "chrome://settings" },
    })

    expect(out.card.kind).toBe("stale-incompatible")
    if (out.card.kind === "stale-incompatible") {
      expect(out.card.title).toBe("Settings")
      expect(out.card.origin).toBe("chrome://settings")
    }
  })
})
