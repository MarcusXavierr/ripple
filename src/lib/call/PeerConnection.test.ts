// src/lib/call/PeerConnection.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ClientMessage } from "@/types/signaling"
import {
  installGlobalMocks,
  MockRTCDataChannel,
  MockRTCPeerConnection,
  resetMocks,
} from "./__tests__/mocks"
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

function makeCallbacks(): PeerConnectionCallbacks {
  return {
    onRemoteStream: vi.fn(),
    onIceConnected: vi.fn(),
    onIceFailed: vi.fn(),
    onChannelOpen: vi.fn(),
    onChannelClose: vi.fn(),
    onChannelMessage: vi.fn(),
  }
}

/** Returns the mock channel for the given label from the last MockRTCPeerConnection instance. */
function getCreatedChannel(label: string): MockRTCDataChannel {
  const created = (MockRTCPeerConnection.lastInstance as any)._createdChannels as Array<{
    label: string
    init: RTCDataChannelInit | undefined
  }>
  const entry = created.find((c) => c.label === label)
  if (!entry) throw new Error(`No channel created with label "${label}"`)
  // Find matching channel instance via createDataChannel mock calls
  const calls = (MockRTCPeerConnection.lastInstance as any).createDataChannel.mock.results
  const idx = created.indexOf(entry)
  return calls[idx].value as MockRTCDataChannel
}

/** Opens a caller channel and returns the mock. */
function openChannel(_pc: PeerConnection, label: string): MockRTCDataChannel {
  const ch = getCreatedChannel(label)
  ch._fireOpen()
  return ch
}

function makeMockChannel(label: string): MockRTCDataChannel {
  return new MockRTCDataChannel(label)
}

beforeEach(() => {
  resetMocks()
})

// ── setup() ─────────────────────────────────────────────────────────────────

describe("setup()", () => {
  it("creates an RTCPeerConnection", () => {
    const pc = new PeerConnection(createTransport(), makeCallbacks())
    pc.setup("caller")
    expect(MockRTCPeerConnection.lastInstance).not.toBeNull()
  })

  it("closes previous PC when called again", () => {
    const pc = new PeerConnection(createTransport(), makeCallbacks())
    pc.setup("caller")
    const first = MockRTCPeerConnection.lastInstance!
    pc.setup("callee")
    expect(first.close).toHaveBeenCalled()
  })

  it("exposes raw PC via getter", () => {
    const pc = new PeerConnection(createTransport(), makeCallbacks())
    pc.setup("caller")
    expect(pc.raw).toBe(MockRTCPeerConnection.lastInstance)
  })
})

// ── DataChannelSpec ──────────────────────────────────────────────────────────

describe("DataChannelSpec", () => {
  it("creates one data channel per DataChannelSpec passed to the constructor", () => {
    const specs = [
      { label: "alpha", init: { ordered: true } },
      { label: "beta", init: { ordered: true, maxRetransmits: 0 } },
    ]
    const pc = new PeerConnection(createTransport(), makeCallbacks(), specs)
    pc.setup("caller")

    const created = (pc.raw as any)._createdChannels as Array<{
      label: string
      init: RTCDataChannelInit
    }>
    expect(created).toHaveLength(2)
    expect(created.find((c) => c.label === "alpha")?.init.ordered).toBe(true)
    expect(created.find((c) => c.label === "beta")?.init.maxRetransmits).toBe(0)
  })

  it("creates no data channels when no specs are provided", () => {
    const pc = new PeerConnection(createTransport(), makeCallbacks())
    pc.setup("caller")
    expect((pc.raw as any)._createdChannels).toEqual([])
  })

  it("throws when DataChannelSpecs contain duplicate labels", () => {
    const specs = [
      { label: "alpha", init: { ordered: true } },
      { label: "alpha", init: { ordered: true, maxRetransmits: 0 } },
    ]
    expect(() => new PeerConnection(createTransport(), makeCallbacks(), specs)).toThrow(
      /duplicate/i
    )
  })
})

// ── sendOnChannel ────────────────────────────────────────────────────────────

describe("sendOnChannel", () => {
  it("returns false and writes nothing when channel is not open", () => {
    const pc = new PeerConnection(createTransport(), makeCallbacks(), [
      { label: "alpha", init: { ordered: true } },
    ])
    pc.setup("caller")
    expect(pc.sendOnChannel("alpha", "x")).toBe(false)
  })

  it("writes the raw string and returns true when open", () => {
    const pc = new PeerConnection(createTransport(), makeCallbacks(), [
      { label: "alpha", init: { ordered: true } },
    ])
    pc.setup("caller")
    const ch = openChannel(pc, "alpha")
    expect(pc.sendOnChannel("alpha", "payload")).toBe(true)
    expect(ch._sent).toEqual(["payload"])
  })

  it("returns false for unknown labels", () => {
    const pc = new PeerConnection(createTransport(), makeCallbacks())
    pc.setup("caller")
    expect(pc.sendOnChannel("does-not-exist", "x")).toBe(false)
  })
})

// ── channel receive path ─────────────────────────────────────────────────────

describe("channel receive path", () => {
  it("forwards raw onmessage data with the channel label", () => {
    const cbs = makeCallbacks()
    const pc = new PeerConnection(createTransport(), cbs, [{ label: "alpha" }])
    pc.setup("caller")
    const ch = openChannel(pc, "alpha")
    ch._fireMessage("hello")
    expect(cbs.onChannelMessage).toHaveBeenCalledWith("alpha", "hello")
  })

  it("does not parse or validate payloads", () => {
    const cbs = makeCallbacks()
    const pc = new PeerConnection(createTransport(), cbs, [{ label: "alpha" }])
    pc.setup("caller")
    const ch = openChannel(pc, "alpha")
    ch._fireMessage("not json")
    expect(cbs.onChannelMessage).toHaveBeenCalledWith("alpha", "not json")
  })

  it("callee binds incoming channels whose label is in the spec", () => {
    const cbs = makeCallbacks()
    const pc = new PeerConnection(createTransport(), cbs, [{ label: "alpha" }, { label: "beta" }])
    pc.setup("callee")
    const a = makeMockChannel("alpha")
    const b = makeMockChannel("beta")
    ;(pc.raw as any).ondatachannel({ channel: a })
    ;(pc.raw as any).ondatachannel({ channel: b })
    a._fireOpen()
    b._fireOpen()
    expect(cbs.onChannelOpen).toHaveBeenCalledWith("alpha")
    expect(cbs.onChannelOpen).toHaveBeenCalledWith("beta")
  })

  it("callee ignores incoming channels with unknown labels", () => {
    const cbs = makeCallbacks()
    const pc = new PeerConnection(createTransport(), cbs, [{ label: "alpha" }])
    pc.setup("callee")
    const garbage = makeMockChannel("garbage")
    ;(pc.raw as any).ondatachannel({ channel: garbage })
    garbage._fireOpen()
    expect(cbs.onChannelOpen).not.toHaveBeenCalled()
  })

  it("clears the channel reference and notifies on close", () => {
    const cbs = makeCallbacks()
    const pc = new PeerConnection(createTransport(), cbs, [{ label: "alpha" }])
    pc.setup("caller")
    const ch = openChannel(pc, "alpha")
    ch._fireClose()
    expect(cbs.onChannelClose).toHaveBeenCalledWith("alpha")
    expect(pc.sendOnChannel("alpha", "x")).toBe(false)
  })

  it("close() clears all channel references", () => {
    const pc = new PeerConnection(createTransport(), makeCallbacks(), [
      { label: "alpha" },
      { label: "beta" },
    ])
    pc.setup("caller")
    openChannel(pc, "alpha")
    openChannel(pc, "beta")
    pc.close()
    expect(pc.sendOnChannel("alpha", "x")).toBe(false)
    expect(pc.sendOnChannel("beta", "x")).toBe(false)
  })

  it("ignores a stale onclose from a previous-generation channel", () => {
    const cbs = makeCallbacks()
    const pc = new PeerConnection(createTransport(), cbs, [{ label: "alpha" }])
    pc.setup("caller")
    const oldCh = openChannel(pc, "alpha")
    pc.setup("caller") // reconnect: new generation, new channel
    const newCh = openChannel(pc, "alpha")

    oldCh._fireClose() // late event from previous generation

    expect(pc.sendOnChannel("alpha", "still works")).toBe(true)
    expect(newCh._sent).toContain("still works")
    const closesForAlpha = (cbs.onChannelClose as any).mock.calls.filter(
      (args: unknown[]) => args[0] === "alpha"
    )
    expect(closesForAlpha).toHaveLength(0)
  })
})

// ── setup() event wiring ────────────────────────────────────────────────────

describe("setup() → onicecandidate", () => {
  it("sends ice-candidate through transport when candidate fires", () => {
    const transport = createTransport()
    const pc = new PeerConnection(transport, makeCallbacks())
    pc.setup("caller")
    const candidate = { toJSON: () => ({ candidate: "c", sdpMid: "0", sdpMLineIndex: 0 }) }
    MockRTCPeerConnection.lastInstance?.onicecandidate?.({
      candidate,
    } as unknown as RTCPeerConnectionIceEvent)
    expect(transport.sent).toEqual([{ type: "ice-candidate", candidate: candidate.toJSON() }])
  })

  it("does not send when candidate is null", () => {
    const transport = createTransport()
    const pc = new PeerConnection(transport, makeCallbacks())
    pc.setup("caller")
    MockRTCPeerConnection.lastInstance?.onicecandidate?.({
      candidate: null,
    } as RTCPeerConnectionIceEvent)
    expect(transport.sent).toHaveLength(0)
  })
})

describe("setup() → ontrack", () => {
  it("fires onRemoteStream callback", () => {
    const callbacks = makeCallbacks()
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
    const pc = new PeerConnection(transport, makeCallbacks())
    pc.setup("caller")
    await MockRTCPeerConnection.lastInstance?.onnegotiationneeded?.()
    expect(transport.sent.some((m) => m.type === "offer")).toBe(true)
  })

  it("does not send offer when callee", async () => {
    const transport = createTransport()
    const pc = new PeerConnection(transport, makeCallbacks())
    pc.setup("callee")
    await MockRTCPeerConnection.lastInstance?.onnegotiationneeded?.()
    expect(transport.sent).toHaveLength(0)
  })
})

describe("setup() → oniceconnectionstatechange", () => {
  it("fires onIceConnected when ICE is connected", () => {
    const callbacks = makeCallbacks()
    const pc = new PeerConnection(createTransport(), callbacks)
    pc.setup("caller")
    const mockPC = MockRTCPeerConnection.lastInstance!
    mockPC.iceConnectionState = "connected"
    mockPC.oniceconnectionstatechange?.()
    expect(callbacks.onIceConnected).toHaveBeenCalled()
  })

  it("fires onIceFailed when ICE fails", () => {
    const callbacks = makeCallbacks()
    const pc = new PeerConnection(createTransport(), callbacks)
    pc.setup("caller")
    const mockPC = MockRTCPeerConnection.lastInstance!
    mockPC.iceConnectionState = "failed"
    mockPC.oniceconnectionstatechange?.()
    expect(callbacks.onIceFailed).toHaveBeenCalled()
  })
})

// ── close() ─────────────────────────────────────────────────────────────────

describe("close()", () => {
  it("calls pc.close()", () => {
    const pc = new PeerConnection(createTransport(), makeCallbacks())
    pc.setup("caller")
    pc.close()
    expect(MockRTCPeerConnection.lastInstance?.close).toHaveBeenCalled()
  })
})

// ── handleOffer() ──────────────────────────────────────────────────────────

describe("handleOffer()", () => {
  it("sets remote description and sends answer via transport", async () => {
    const transport = createTransport()
    const pc = new PeerConnection(transport, makeCallbacks())
    pc.setup("callee")
    await pc.handleOffer({ type: "offer", sdp: "remote-sdp" })
    const mockPC = MockRTCPeerConnection.lastInstance!
    expect(mockPC.setRemoteDescription).toHaveBeenCalledWith({ type: "offer", sdp: "remote-sdp" })
    expect(transport.sent.some((m) => m.type === "answer")).toBe(true)
  })

  it("ignores offer when not callee and collision detected", async () => {
    const transport = createTransport()
    const pc = new PeerConnection(transport, makeCallbacks())
    pc.setup("caller")
    const mockPC = MockRTCPeerConnection.lastInstance!
    mockPC.signalingState = "have-local-offer"
    await pc.handleOffer({ type: "offer", sdp: "sdp" })
    expect(mockPC.setRemoteDescription).not.toHaveBeenCalled()
    expect(transport.sent).toHaveLength(0)
  })

  it("accepts offer in collision when callee (polite peer)", async () => {
    const transport = createTransport()
    const pc = new PeerConnection(transport, makeCallbacks())
    pc.setup("callee")
    const mockPC = MockRTCPeerConnection.lastInstance!
    mockPC.signalingState = "have-local-offer"
    await pc.handleOffer({ type: "offer", sdp: "sdp" })
    expect(mockPC.setRemoteDescription).toHaveBeenCalled()
  })

  it("rolls back before applying offer if not in stable state", async () => {
    const transport = createTransport()
    const pc = new PeerConnection(transport, makeCallbacks())
    pc.setup("callee")
    const mockPC = MockRTCPeerConnection.lastInstance!
    mockPC.signalingState = "have-local-offer"
    await pc.handleOffer({ type: "offer", sdp: "sdp" })
    expect(mockPC.setLocalDescription).toHaveBeenCalledWith({ type: "rollback" })
  })

  it("does nothing when PC is null", async () => {
    const pc = new PeerConnection(createTransport(), makeCallbacks())
    // Don't call setup() — pc is null
    await pc.handleOffer({ type: "offer", sdp: "sdp" })
    // Should not throw
  })
})

// ── handleAnswer() ──────────────────────────────────────────────────────────

describe("handleAnswer()", () => {
  it("sets remote description", async () => {
    const pc = new PeerConnection(createTransport(), makeCallbacks())
    pc.setup("caller")
    await pc.handleAnswer({ type: "answer", sdp: "answer-sdp" })
    expect(MockRTCPeerConnection.lastInstance?.setRemoteDescription).toHaveBeenCalledWith({
      type: "answer",
      sdp: "answer-sdp",
    })
  })

  it("drains queued ICE candidates after setting remote description", async () => {
    const pc = new PeerConnection(createTransport(), makeCallbacks())
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
    const pc = new PeerConnection(createTransport(), makeCallbacks())
    await pc.handleAnswer({ type: "answer", sdp: "sdp" })
    // Should not throw
  })
})

// ── handleIceCandidate() ────────────────────────────────────────────────────

describe("handleIceCandidate()", () => {
  it("queues candidates before remote description is set", async () => {
    const pc = new PeerConnection(createTransport(), makeCallbacks())
    pc.setup("callee")
    await pc.handleIceCandidate({ candidate: "c1", sdpMid: "0", sdpMLineIndex: 0 })
    expect(MockRTCPeerConnection.lastInstance?.addIceCandidate).not.toHaveBeenCalled()
  })

  it("adds candidates directly after remote description", async () => {
    const pc = new PeerConnection(createTransport(), makeCallbacks())
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

// ── rollbackAndRestartIce() ─────────────────────────────────────────────────

describe("rollbackAndRestartIce()", () => {
  it("rolls back local description then restarts ICE", async () => {
    const pc = new PeerConnection(createTransport(), makeCallbacks())
    pc.setup("caller")
    const mockPC = MockRTCPeerConnection.lastInstance!
    mockPC.signalingState = "have-local-offer"
    await pc.rollbackAndRestartIce()
    expect(mockPC.setLocalDescription).toHaveBeenCalledWith({ type: "rollback" })
    expect(mockPC.restartIce).toHaveBeenCalled()
  })

  it("does nothing when PC is null", async () => {
    const pc = new PeerConnection(createTransport(), makeCallbacks())
    await pc.rollbackAndRestartIce()
    // Should not throw
  })
})
