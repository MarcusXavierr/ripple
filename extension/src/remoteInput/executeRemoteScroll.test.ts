import type { PeerVideoScroll } from "@shared/remoteInputProtocol"
import { describe, expect, it, vi } from "vitest"
import { executeRemoteScroll } from "./executeRemoteScroll"

const scroll: PeerVideoScroll = {
  x: 10,
  y: 20,
  width: 100,
  height: 100,
  xRatio: 0.5,
  yRatio: 0.25,
  clickerViewportWidth: 1280,
  clickerViewportHeight: 720,
  clickerScreenWidth: 1920,
  clickerScreenHeight: 1080,
  devicePixelRatio: 1,
  deltaX: 0,
  deltaY: 40,
  deltaMode: 0,
}

function mockElementFromPoint(target: Element | null) {
  Object.defineProperty(document, "elementFromPoint", {
    value: vi.fn().mockReturnValue(target),
    configurable: true,
    writable: true,
  })
}

describe("executeRemoteScroll", () => {
  it("scrolls the nearest scrollable ancestor with pixel deltas", () => {
    document.body.innerHTML = `
      <div id="scroller" style="height: 100px; overflow: auto;">
        <button id="target">Target</button>
      </div>
    `
    const scroller = document.getElementById("scroller") as HTMLDivElement
    const target = document.getElementById("target") as HTMLButtonElement
    Object.defineProperties(scroller, {
      clientHeight: { value: 100, configurable: true },
      scrollHeight: { value: 300, configurable: true },
      scrollTop: { value: 0, writable: true, configurable: true },
    })
    const scrollBy = vi.fn()
    Object.defineProperty(scroller, "scrollBy", { value: scrollBy, configurable: true })
    mockElementFromPoint(target)

    expect(executeRemoteScroll({ x: 10, y: 20 }, scroll, document)).toEqual({
      ok: true,
      stage: "scrolled",
    })
    expect(scrollBy).toHaveBeenCalledWith({ left: 0, top: 40, behavior: "instant" })
  })

  it("converts line deltas using computed line height", () => {
    document.body.innerHTML = `
      <div id="scroller" style="height: 100px; overflow: auto; line-height: 20px;">
        <button id="target">Target</button>
      </div>
    `
    const scroller = document.getElementById("scroller") as HTMLDivElement
    const target = document.getElementById("target") as HTMLButtonElement
    Object.defineProperties(scroller, {
      clientHeight: { value: 100, configurable: true },
      scrollHeight: { value: 300, configurable: true },
      scrollTop: { value: 0, writable: true, configurable: true },
    })
    const scrollBy = vi.fn()
    Object.defineProperty(scroller, "scrollBy", { value: scrollBy, configurable: true })
    mockElementFromPoint(target)

    executeRemoteScroll({ x: 10, y: 20 }, { ...scroll, deltaY: 3, deltaMode: 1 }, document)

    expect(scrollBy).toHaveBeenCalledWith({ left: 0, top: 60, behavior: "instant" })
  })

  it("converts page deltas using the scroll container size", () => {
    document.body.innerHTML = `<div id="scroller" style="height: 100px; overflow: auto;"></div>`
    const scroller = document.getElementById("scroller") as HTMLDivElement
    Object.defineProperties(scroller, {
      clientWidth: { value: 200, configurable: true },
      clientHeight: { value: 100, configurable: true },
      scrollHeight: { value: 300, configurable: true },
      scrollTop: { value: 0, writable: true, configurable: true },
    })
    const scrollBy = vi.fn()
    Object.defineProperty(scroller, "scrollBy", { value: scrollBy, configurable: true })
    mockElementFromPoint(scroller)

    executeRemoteScroll(
      { x: 10, y: 20 },
      { ...scroll, deltaX: 1, deltaY: 1, deltaMode: 2 },
      document
    )

    expect(scrollBy).toHaveBeenCalledWith({ left: 200, top: 100, behavior: "instant" })
  })

  it("falls back to document scroll when element scrollBy has no effect", () => {
    document.body.innerHTML = `
      <div id="scroller" style="height: 100px; overflow: auto;">
        <button id="target">Target</button>
      </div>
    `
    const scroller = document.getElementById("scroller") as HTMLDivElement
    const target = document.getElementById("target") as HTMLButtonElement
    Object.defineProperties(scroller, {
      clientHeight: { value: 100, configurable: true },
      scrollHeight: { value: 300, configurable: true },
      scrollTop: { value: 50, writable: true, configurable: true },
    })
    // scrollBy on the element does NOT change scrollTop (simulates a virtual scroller)
    const elementScrollBy = vi.fn()
    Object.defineProperty(scroller, "scrollBy", { value: elementScrollBy, configurable: true })
    mockElementFromPoint(target)

    // Create a standalone element to act as the document scroller so we have full control
    const fakeDocScroller = document.createElement("div")
    Object.defineProperties(fakeDocScroller, {
      clientHeight: { value: 600, configurable: true },
      scrollHeight: { value: 1200, configurable: true },
      scrollTop: { value: 0, writable: true, configurable: true },
    })
    const docScrollBy = vi.fn()
    Object.defineProperty(fakeDocScroller, "scrollBy", { value: docScrollBy, configurable: true })
    Object.defineProperty(document, "scrollingElement", {
      get: () => fakeDocScroller,
      configurable: true,
    })

    try {
      expect(executeRemoteScroll({ x: 10, y: 20 }, scroll, document)).toEqual({
        ok: true,
        stage: "scrolled",
      })
      expect(elementScrollBy).toHaveBeenCalledWith({ left: 0, top: 40, behavior: "instant" })
      expect(docScrollBy).toHaveBeenCalledWith({ left: 0, top: 40, behavior: "instant" })
    } finally {
      // Restore scrollingElement so it doesn't bleed into subsequent tests
      Object.defineProperty(document, "scrollingElement", {
        get: () => document.documentElement,
        configurable: true,
      })
    }
  })

  it("rejects when no scrollable target can be found", () => {
    document.body.innerHTML = `<button id="target">Target</button>`
    mockElementFromPoint(document.getElementById("target"))

    expect(executeRemoteScroll({ x: 10, y: 20 }, scroll, document)).toEqual({
      ok: false,
      reason: "reason_scroll_target_not_found",
      stage: "target",
    })
  })
})
