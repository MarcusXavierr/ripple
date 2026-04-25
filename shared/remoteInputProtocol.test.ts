import * as v from "valibot"
import {
  ExtensionAckSchema,
  isExtensionAck,
  isPeerVideoClick,
  isRemoteInputMessage,
  type PeerVideoClick,
  PeerVideoClickSchema,
  RemoteInputMessageSchema,
} from "./remoteInputProtocol"

const click: PeerVideoClick = {
  x: 120,
  y: 80,
  width: 640,
  height: 360,
  xRatio: 0.1875,
  yRatio: 0.2222222222222222,
  clickerViewportWidth: 1280,
  clickerViewportHeight: 720,
  clickerScreenWidth: 1920,
  clickerScreenHeight: 1080,
  devicePixelRatio: 1,
}

describe("remote input protocol guards", () => {
  it("accepts a valid peer video click", () => {
    expect(isPeerVideoClick(click)).toBe(true)
  })

  it("rejects malformed peer video click values", () => {
    expect(isPeerVideoClick({ ...click, xRatio: Number.NaN })).toBe(false)
    expect(isPeerVideoClick({ ...click, width: "640" })).toBe(false)
    expect(isPeerVideoClick({ ...click, y: undefined })).toBe(false)
  })

  it("accepts a valid remote-click message", () => {
    expect(isRemoteInputMessage({ type: "remote-click", click })).toBe(true)
  })

  it("rejects unknown remote input messages", () => {
    expect(isRemoteInputMessage({ type: "remote-scroll", click })).toBe(false)
    expect(isRemoteInputMessage({ type: "remote-click", click: { x: 1 } })).toBe(false)
  })

  it("accepts extension acks", () => {
    expect(isExtensionAck({ ok: true, type: "remote-click-applied", targetTabId: 42 })).toBe(true)
    expect(
      isExtensionAck({
        ok: false,
        type: "remote-click-rejected",
        reason: "no selected tab",
        stage: "selected-tab",
      })
    ).toBe(true)
  })

  it("rejects malformed extension acks", () => {
    expect(isExtensionAck({ ok: true, type: "remote-click-applied" })).toBe(false)
    expect(isExtensionAck({ ok: false, type: "remote-click-rejected" })).toBe(false)
  })

  it("exports reusable schemas for shared validation", () => {
    expect(v.safeParse(PeerVideoClickSchema, click).success).toBe(true)
    expect(v.safeParse(RemoteInputMessageSchema, { type: "remote-click", click }).success).toBe(
      true
    )
    expect(
      v.safeParse(ExtensionAckSchema, { ok: true, type: "remote-click-applied", targetTabId: 7 })
        .success
    ).toBe(true)
  })

  it("rejects invalid schema inputs", () => {
    expect(v.safeParse(PeerVideoClickSchema, { ...click, x: Number.NaN }).success).toBe(false)
    expect(
      v.safeParse(RemoteInputMessageSchema, { type: "remote-click", click: { x: 1 } }).success
    ).toBe(false)
    expect(
      v.safeParse(ExtensionAckSchema, { ok: false, type: "remote-click-rejected" }).success
    ).toBe(false)
  })
})
