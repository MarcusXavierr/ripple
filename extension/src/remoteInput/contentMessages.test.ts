import * as v from "valibot"
import type { PeerVideoClick } from "@shared/remoteInputProtocol"
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

describe("handleContentMessage", () => {
  it("executes a valid remote click", () => {
    const result = handleContentMessage(
      { type: "execute-remote-click", click },
      {
        viewport: { width: 1000, height: 800 },
        execute: vi.fn().mockReturnValue({ ok: true, stage: "dispatched" }),
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
      }
    )

    expect(result).toEqual({ ok: false, reason: "unknown content message", stage: "message" })
  })

  it("exports a schema for valid content messages", () => {
    expect(v.safeParse(ContentMessageSchema, { type: "execute-remote-click", click }).success).toBe(true)
    expect(v.safeParse(ContentMessageSchema, { type: "execute-remote-click", click: { x: 1 } }).success).toBe(false)
  })
})
