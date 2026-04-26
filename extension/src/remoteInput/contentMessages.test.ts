import type { PeerVideoClick, PeerVideoScroll } from "@shared/remoteInputProtocol"
import * as v from "valibot"
import { ContentMessageSchema, handleContentMessage } from "./contentMessages"

const click: PeerVideoClick = {
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
}

const scroll: PeerVideoScroll = {
  ...click,
  deltaX: 0,
  deltaY: 40,
  deltaMode: 0,
}

describe("handleContentMessage", () => {
  it("executes a valid remote click", () => {
    const result = handleContentMessage(
      { type: "execute-remote-click", click },
      {
        viewport: { width: 1000, height: 800 },
        execute: vi.fn().mockReturnValue({ ok: true, stage: "dispatched" }),
        executeScroll: vi.fn(),
        executeKeyboard: vi.fn(),
      }
    )

    expect(result).toEqual({ ok: true, stage: "dispatched" })
  })

  it("rejects unknown content messages", () => {
    const result = handleContentMessage(
      { type: "unknown" },
      {
        viewport: { width: 1000, height: 800 },
        execute: vi.fn(),
        executeScroll: vi.fn(),
        executeKeyboard: vi.fn(),
      }
    )

    expect(result).toEqual({ ok: false, reason: "unknown content message", stage: "message" })
  })

  it("exports a schema for valid content messages", () => {
    expect(v.safeParse(ContentMessageSchema, { type: "execute-remote-click", click }).success).toBe(
      true
    )
    expect(
      v.safeParse(ContentMessageSchema, { type: "execute-remote-click", click: { x: 1 } }).success
    ).toBe(false)
  })

  it("executes a valid remote scroll", () => {
    const executeScroll = vi.fn().mockReturnValue({ ok: true, stage: "scrolled" })
    const result = handleContentMessage(
      { type: "execute-remote-scroll", scroll },
      {
        viewport: { width: 1000, height: 800 },
        execute: vi.fn(),
        executeScroll,
        executeKeyboard: vi.fn(),
      }
    )

    expect(result).toEqual({ ok: true, stage: "scrolled" })
    expect(executeScroll).toHaveBeenCalledWith({ x: 500, y: 200 }, scroll)
  })

  it("exports a schema for valid remote scroll content messages", () => {
    expect(
      v.safeParse(ContentMessageSchema, { type: "execute-remote-scroll", scroll }).success
    ).toBe(true)
    expect(
      v.safeParse(ContentMessageSchema, { type: "execute-remote-scroll", scroll: { x: 1 } }).success
    ).toBe(false)
  })

  it("executes valid remote keyboard input", () => {
    const keyboard = { key: "a", code: "KeyA", location: 0, repeat: false }
    const executeKeyboard = vi.fn().mockReturnValue({ ok: true, stage: "applied" })
    const result = handleContentMessage(
      { type: "execute-remote-keyboard", keyboard },
      {
        viewport: { width: 1000, height: 800 },
        execute: vi.fn(),
        executeScroll: vi.fn(),
        executeKeyboard,
      }
    )

    expect(result).toEqual({ ok: true, stage: "applied" })
    expect(executeKeyboard).toHaveBeenCalledWith(keyboard)
  })

  it("exports a schema for valid remote keyboard content messages", () => {
    const keyboard = { key: "a", code: "KeyA", location: 0, repeat: false }
    expect(
      v.safeParse(ContentMessageSchema, { type: "execute-remote-keyboard", keyboard }).success
    ).toBe(true)
    expect(
      v.safeParse(ContentMessageSchema, {
        type: "execute-remote-keyboard",
        keyboard: { key: "Tab" },
      }).success
    ).toBe(false)
  })
})
