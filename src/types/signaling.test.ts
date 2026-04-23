import { describe, expect, it } from "vitest"
import type { PeerVideoClick } from "./peerVideoClick"
import { MESSAGE_TYPES } from "./signaling"
import type { ClientMessage, ReceivedMessage } from "./signaling"

type PeerVideoClickClientMessage = Extract<
  ClientMessage,
  { type: typeof MESSAGE_TYPES.PEER_VIDEO_CLICK }
>

type PeerVideoClickReceivedMessage = Extract<
  ReceivedMessage,
  { type: typeof MESSAGE_TYPES.PEER_VIDEO_CLICK }
>

const sampleClick: PeerVideoClick = {
  x: 120,
  y: 45,
  width: 640,
  height: 360,
  xRatio: 0.1875,
  yRatio: 0.125,
  clickerViewportWidth: 1440,
  clickerViewportHeight: 900,
  clickerScreenWidth: 2560,
  clickerScreenHeight: 1440,
  devicePixelRatio: 2,
}

describe("MESSAGE_TYPES", () => {
  it("has all server message type constants", () => {
    expect(MESSAGE_TYPES.ONOPEN).toBe("onopen")
    expect(MESSAGE_TYPES.ENTER).toBe("enter")
    expect(MESSAGE_TYPES.ONCLOSE).toBe("onclose")
    expect(MESSAGE_TYPES.PEER_RECONNECTED).toBe("peer-reconnected")
    expect(MESSAGE_TYPES.PING).toBe("ping")
  })

  it("has all client/relay message type constants", () => {
    expect(MESSAGE_TYPES.OFFER).toBe("offer")
    expect(MESSAGE_TYPES.ANSWER).toBe("answer")
    expect(MESSAGE_TYPES.ICE_CANDIDATE).toBe("ice-candidate")
    expect(MESSAGE_TYPES.PEER_VIDEO_CLICK).toBe("peer-video-click")
    expect(MESSAGE_TYPES.PONG).toBe("pong")
  })

  it("accepts peer video click as both client and relay message", () => {
    // Compile-time coverage: if either union drops this branch, these assignments fail under TypeScript.
    const outbound: PeerVideoClickClientMessage = {
      type: "peer-video-click",
      click: sampleClick,
    }
    const inbound: PeerVideoClickReceivedMessage = {
      type: "peer-video-click",
      click: sampleClick,
    }

    expect(outbound.type).toBe("peer-video-click")
    expect(inbound.type).toBe("peer-video-click")
  })
})
