// src/lib/call/PeerConnection.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ClientMessage } from "@/types/signaling"
import { installGlobalMocks, MockRTCPeerConnection, resetMocks } from "./__tests__/mocks"
import {
  PeerConnection,
  type PeerConnectionCallbacks,
  type PeerConnectionTransport,
} from "./PeerConnection"

installGlobalMocks()

function createTransport(): PeerConnectionTransport & { sent: ClientMessage[] } {
  const sent: ClientMessage[] = []
  return { send: (msg) => sent.push(msg), sent }
}

function createCallbacks(): PeerConnectionCallbacks {
  return {
    onRemoteStream: vi.fn(),
    onStatusChange: vi.fn(),
  }
}

beforeEach(() => {
  resetMocks()
})

// ── setup() ─────────────────────────────────────────────────────────────────

describe("setup()", () => {
  it("creates an RTCPeerConnection", () => {
    const pc = new PeerConnection(createTransport(), createCallbacks())
    pc.setup("caller")
    expect(MockRTCPeerConnection.lastInstance).not.toBeNull()
  })

  it("closes previous PC when called again", () => {
    const pc = new PeerConnection(createTransport(), createCallbacks())
    pc.setup("caller")
    const first = MockRTCPeerConnection.lastInstance!
    pc.setup("callee")
    expect(first.close).toHaveBeenCalled()
  })

  it("exposes state with correct role and signalingState", () => {
    const pc = new PeerConnection(createTransport(), createCallbacks())
    pc.setup("caller")
    expect(pc.state).toEqual({
      role: "caller",
      makingOffer: false,
      signalingState: "stable",
    })
  })

  it("exposes raw PC via getter", () => {
    const pc = new PeerConnection(createTransport(), createCallbacks())
    pc.setup("caller")
    expect(pc.raw).toBe(MockRTCPeerConnection.lastInstance)
  })
})

// ── setup() event wiring ────────────────────────────────────────────────────

describe("setup() → onicecandidate", () => {
  it("sends ice-candidate through transport when candidate fires", () => {
    const transport = createTransport()
    const pc = new PeerConnection(transport, createCallbacks())
    pc.setup("caller")
    const candidate = { toJSON: () => ({ candidate: "c", sdpMid: "0", sdpMLineIndex: 0 }) }
    MockRTCPeerConnection.lastInstance?.onicecandidate?.({
      candidate,
    } as unknown as RTCPeerConnectionIceEvent)
    expect(transport.sent).toEqual([{ type: "ice-candidate", candidate: candidate.toJSON() }])
  })

  it("does not send when candidate is null", () => {
    const transport = createTransport()
    const pc = new PeerConnection(transport, createCallbacks())
    pc.setup("caller")
    MockRTCPeerConnection.lastInstance?.onicecandidate?.({
      candidate: null,
    } as RTCPeerConnectionIceEvent)
    expect(transport.sent).toHaveLength(0)
  })
})

describe("setup() → ontrack", () => {
  it("fires onRemoteStream callback", () => {
    const callbacks = createCallbacks()
    const pc = new PeerConnection(createTransport(), callbacks)
    pc.setup("caller")
    const fakeStream = { id: "remote" }
    MockRTCPeerConnection.lastInstance?.ontrack?.({
      streams: [fakeStream],
    } as unknown as RTCTrackEvent)
    expect(callbacks.onRemoteStream).toHaveBeenCalledWith(fakeStream)
  })
})

describe("setup() → onnegotiationneeded", () => {
  it("sends offer through transport when caller", async () => {
    const transport = createTransport()
    const pc = new PeerConnection(transport, createCallbacks())
    pc.setup("caller")
    await MockRTCPeerConnection.lastInstance?.onnegotiationneeded?.()
    expect(transport.sent.some((m) => m.type === "offer")).toBe(true)
  })

  it("does not send offer when callee", async () => {
    const transport = createTransport()
    const pc = new PeerConnection(transport, createCallbacks())
    pc.setup("callee")
    await MockRTCPeerConnection.lastInstance?.onnegotiationneeded?.()
    expect(transport.sent).toHaveLength(0)
  })

  it("resets makingOffer to false after onnegotiationneeded completes", async () => {
    const pc = new PeerConnection(createTransport(), createCallbacks())
    pc.setup("caller")
    await MockRTCPeerConnection.lastInstance?.onnegotiationneeded?.()
    expect(pc.state.makingOffer).toBe(false)
  })
})

describe("setup() → oniceconnectionstatechange", () => {
  it("fires onStatusChange connected when ICE is connected", () => {
    const callbacks = createCallbacks()
    const pc = new PeerConnection(createTransport(), callbacks)
    pc.setup("caller")
    const mockPC = MockRTCPeerConnection.lastInstance!
    mockPC.iceConnectionState = "connected"
    mockPC.oniceconnectionstatechange?.()
    expect(callbacks.onStatusChange).toHaveBeenCalledWith("connected")
  })

  it("fires onStatusChange connected when ICE is completed", () => {
    const callbacks = createCallbacks()
    const pc = new PeerConnection(createTransport(), callbacks)
    pc.setup("caller")
    const mockPC = MockRTCPeerConnection.lastInstance!
    mockPC.iceConnectionState = "completed"
    mockPC.oniceconnectionstatechange?.()
    expect(callbacks.onStatusChange).toHaveBeenCalledWith("connected")
  })

  it("fires reconnecting + restartIce when ICE fails as caller", () => {
    const callbacks = createCallbacks()
    const pc = new PeerConnection(createTransport(), callbacks)
    pc.setup("caller")
    const mockPC = MockRTCPeerConnection.lastInstance!
    mockPC.iceConnectionState = "failed"
    mockPC.oniceconnectionstatechange?.()
    expect(callbacks.onStatusChange).toHaveBeenCalledWith("reconnecting")
    expect(mockPC.restartIce).toHaveBeenCalled()
  })

  it("does not call restartIce when ICE fails as callee", () => {
    const callbacks = createCallbacks()
    const pc = new PeerConnection(createTransport(), callbacks)
    pc.setup("callee")
    const mockPC = MockRTCPeerConnection.lastInstance!
    mockPC.iceConnectionState = "failed"
    mockPC.oniceconnectionstatechange?.()
    expect(callbacks.onStatusChange).toHaveBeenCalledWith("reconnecting")
    expect(mockPC.restartIce).not.toHaveBeenCalled()
  })
})

// ── close() ─────────────────────────────────────────────────────────────────

describe("close()", () => {
  it("calls pc.close()", () => {
    const pc = new PeerConnection(createTransport(), createCallbacks())
    pc.setup("caller")
    pc.close()
    expect(MockRTCPeerConnection.lastInstance?.close).toHaveBeenCalled()
  })
})

// ── handleOffer() ──────────────────────────────────────────────────────────

describe("handleOffer()", () => {
  it("sets remote description and sends answer via transport", async () => {
    const transport = createTransport()
    const pc = new PeerConnection(transport, createCallbacks())
    pc.setup("callee")
    await pc.handleOffer({ type: "offer", sdp: "remote-sdp" })
    const mockPC = MockRTCPeerConnection.lastInstance!
    expect(mockPC.setRemoteDescription).toHaveBeenCalledWith({ type: "offer", sdp: "remote-sdp" })
    expect(transport.sent.some((m) => m.type === "answer")).toBe(true)
  })

  it("ignores offer when not callee and collision detected", async () => {
    const transport = createTransport()
    const pc = new PeerConnection(transport, createCallbacks())
    pc.setup("caller")
    const mockPC = MockRTCPeerConnection.lastInstance!
    mockPC.signalingState = "have-local-offer"
    await pc.handleOffer({ type: "offer", sdp: "sdp" })
    expect(mockPC.setRemoteDescription).not.toHaveBeenCalled()
    expect(transport.sent).toHaveLength(0)
  })

  it("accepts offer in collision when callee (polite peer)", async () => {
    const transport = createTransport()
    const pc = new PeerConnection(transport, createCallbacks())
    pc.setup("callee")
    const mockPC = MockRTCPeerConnection.lastInstance!
    mockPC.signalingState = "have-local-offer"
    await pc.handleOffer({ type: "offer", sdp: "sdp" })
    expect(mockPC.setRemoteDescription).toHaveBeenCalled()
  })

  it("rolls back before applying offer if not in stable state", async () => {
    const transport = createTransport()
    const pc = new PeerConnection(transport, createCallbacks())
    pc.setup("callee")
    const mockPC = MockRTCPeerConnection.lastInstance!
    mockPC.signalingState = "have-local-offer"
    await pc.handleOffer({ type: "offer", sdp: "sdp" })
    expect(mockPC.setLocalDescription).toHaveBeenCalledWith({ type: "rollback" })
  })

  it("does nothing when PC is null", async () => {
    const pc = new PeerConnection(createTransport(), createCallbacks())
    // Don't call setup() — pc is null
    await pc.handleOffer({ type: "offer", sdp: "sdp" })
    // Should not throw
  })
})

// ── handleAnswer() ──────────────────────────────────────────────────────────

describe("handleAnswer()", () => {
  it("sets remote description", async () => {
    const pc = new PeerConnection(createTransport(), createCallbacks())
    pc.setup("caller")
    await pc.handleAnswer({ type: "answer", sdp: "answer-sdp" })
    expect(MockRTCPeerConnection.lastInstance?.setRemoteDescription).toHaveBeenCalledWith({
      type: "answer",
      sdp: "answer-sdp",
    })
  })

  it("drains queued ICE candidates after setting remote description", async () => {
    const pc = new PeerConnection(createTransport(), createCallbacks())
    pc.setup("caller")
    // Queue a candidate before remote description
    await pc.handleIceCandidate({ candidate: "c1", sdpMid: "0", sdpMLineIndex: 0 })
    // Now handle answer — should drain
    await pc.handleAnswer({ type: "answer", sdp: "answer-sdp" })
    expect(MockRTCPeerConnection.lastInstance?.addIceCandidate).toHaveBeenCalledWith({
      candidate: "c1",
      sdpMid: "0",
      sdpMLineIndex: 0,
    })
  })

  it("does nothing when PC is null", async () => {
    const pc = new PeerConnection(createTransport(), createCallbacks())
    await pc.handleAnswer({ type: "answer", sdp: "sdp" })
    // Should not throw
  })
})

// ── handleIceCandidate() ────────────────────────────────────────────────────

describe("handleIceCandidate()", () => {
  it("queues candidates before remote description is set", async () => {
    const pc = new PeerConnection(createTransport(), createCallbacks())
    pc.setup("callee")
    await pc.handleIceCandidate({ candidate: "c1", sdpMid: "0", sdpMLineIndex: 0 })
    expect(MockRTCPeerConnection.lastInstance?.addIceCandidate).not.toHaveBeenCalled()
  })

  it("adds candidates directly after remote description", async () => {
    const pc = new PeerConnection(createTransport(), createCallbacks())
    pc.setup("callee")
    // Set remote description via handleOffer
    await pc.handleOffer({ type: "offer", sdp: "remote" })
    // Now candidate should be added directly
    await pc.handleIceCandidate({ candidate: "c1", sdpMid: "0", sdpMLineIndex: 0 })
    expect(MockRTCPeerConnection.lastInstance?.addIceCandidate).toHaveBeenCalledWith({
      candidate: "c1",
      sdpMid: "0",
      sdpMLineIndex: 0,
    })
  })
})

// ── restartIce() ────────────────────────────────────────────────────────────

describe("restartIce()", () => {
  it("calls pc.restartIce()", () => {
    const pc = new PeerConnection(createTransport(), createCallbacks())
    pc.setup("caller")
    pc.restartIce()
    expect(MockRTCPeerConnection.lastInstance?.restartIce).toHaveBeenCalled()
  })
})

// ── rollbackAndRestartIce() ─────────────────────────────────────────────────

describe("rollbackAndRestartIce()", () => {
  it("rolls back local description then restarts ICE", async () => {
    const pc = new PeerConnection(createTransport(), createCallbacks())
    pc.setup("caller")
    const mockPC = MockRTCPeerConnection.lastInstance!
    mockPC.signalingState = "have-local-offer"
    await pc.rollbackAndRestartIce()
    expect(mockPC.setLocalDescription).toHaveBeenCalledWith({ type: "rollback" })
    expect(mockPC.restartIce).toHaveBeenCalled()
  })

  it("does nothing when PC is null", async () => {
    const pc = new PeerConnection(createTransport(), createCallbacks())
    await pc.rollbackAndRestartIce()
    // Should not throw
  })
})
