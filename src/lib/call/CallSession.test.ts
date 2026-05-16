import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest"
import { track } from "@/lib/analytics"
import { useCallStore } from "@/store/call"
import { samplePeerKeyboardInput } from "@/testing/peerKeyboardInput.fixture"
import { samplePeerVideoClick } from "@/testing/peerVideoClick.fixture"
import { samplePeerVideoScroll } from "@/testing/peerVideoScroll.fixture"
import { CallSession } from "./CallSession"
import type { PeerConnectionCallbacks } from "./PeerConnection"
import { RemoteInputTransport } from "./RemoteInputTransport"
import type { SignalingChannelCallbacks } from "./SignalingChannel"

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  isAnalyticsEnabled: false,
  posthogClient: { capture: vi.fn() },
}))

const trackMock = vi.mocked(track)

const {
  sendRemoteClickMock,
  sendRemoteScrollMock,
  sendRemoteKeyboardMock,
  signalingSend,
  machineHandleProtocolMessage,
  mockedPeerConnection,
  PeerConnectionConstructorSpy,
  capturedPeerConnectionCallbacksRef,
  capturedSignalingCallbacksRef,
  capturedMachineDepsRef,
  mediaInit,
  signalingState,
  signalingClose,
} = vi.hoisted(() => {
  const capturedPeerConnectionCallbacksRef: { value: PeerConnectionCallbacks | null } = {
    value: null,
  }
  const capturedSignalingCallbacksRef: { value: SignalingChannelCallbacks | null } = {
    value: null,
  }
  const capturedMachineDepsRef: { value: unknown } = { value: null }
  const mediaInit = vi.fn(async () => undefined as unknown)
  const signalingState = { isAlive: true }
  const signalingClose = vi.fn()
  const mockedPeerConnection = {
    raw: null,
    close: vi.fn(),
    setup: vi.fn(),
    handleOffer: vi.fn(),
    handleAnswer: vi.fn(),
    handleIceCandidate: vi.fn(),
    rollbackAndRestartIce: vi.fn(),
    sendOnChannel: vi.fn().mockReturnValue(true),
  }
  const PeerConnectionConstructorSpy = vi.fn(function PeerConnectionMock(
    _transport: unknown,
    callbacks: PeerConnectionCallbacks,
    _dataChannels: unknown
  ) {
    capturedPeerConnectionCallbacksRef.value = callbacks
    return mockedPeerConnection
  })
  return {
    sendRemoteClickMock: vi.fn(),
    sendRemoteScrollMock: vi.fn(),
    sendRemoteKeyboardMock: vi.fn(),
    signalingSend: vi.fn(),
    machineHandleProtocolMessage: vi.fn(),
    mockedPeerConnection,
    PeerConnectionConstructorSpy,
    capturedPeerConnectionCallbacksRef,
    capturedSignalingCallbacksRef,
    capturedMachineDepsRef,
    mediaInit,
    signalingState,
    signalingClose,
  }
})

vi.mock("@/platform/extensionBridge", () => ({
  extensionBridge: {
    sendRemoteClick: (...args: unknown[]) => sendRemoteClickMock(...args),
    sendRemoteScroll: (...args: unknown[]) => sendRemoteScrollMock(...args),
    sendRemoteKeyboard: (...args: unknown[]) => sendRemoteKeyboardMock(...args),
  },
}))

vi.mock("@/lib/peerId", () => ({
  getPeerId: () => "peer-123",
}))

vi.mock("./MediaController", () => ({
  MediaController: vi.fn().mockImplementation(function MediaControllerMock() {
    return {
      init: mediaInit,
      teardown: vi.fn(),
      attachPC: vi.fn(),
    }
  }),
}))

vi.mock("./PeerConnection", () => ({
  PeerConnection: PeerConnectionConstructorSpy,
}))

vi.mock("./SignalingMachine", () => ({
  SignalingMachine: vi.fn().mockImplementation(function SignalingMachineMock(deps: unknown) {
    capturedMachineDepsRef.value = deps
    return {
      handleProtocolMessage: machineHandleProtocolMessage,
      send: vi.fn(),
    }
  }),
}))

vi.mock("./SignalingChannel", () => ({
  SignalingChannel: vi.fn().mockImplementation(function SignalingChannelMock(
    _url: string,
    callbacks: SignalingChannelCallbacks
  ) {
    capturedSignalingCallbacksRef.value = callbacks
    return {
      send: signalingSend,
      connect: vi.fn(),
      close: signalingClose,
      get isAlive() {
        return signalingState.isAlive
      },
    }
  }),
}))

let sendSpy: MockInstance<RemoteInputTransport["send"]>
let handleChannelMessageSpy: MockInstance<RemoteInputTransport["handleChannelMessage"]>

beforeEach(() => {
  window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }))
  capturedPeerConnectionCallbacksRef.value = null
  capturedSignalingCallbacksRef.value = null
  capturedMachineDepsRef.value = null
  signalingState.isAlive = true
  mockedPeerConnection.sendOnChannel.mockReset()
  mockedPeerConnection.sendOnChannel.mockReturnValue(true)
  signalingSend.mockReset()
  signalingClose.mockReset()
  machineHandleProtocolMessage.mockReset()
  trackMock.mockReset()
  mediaInit.mockReset()
  mediaInit.mockResolvedValue(undefined)
  sendRemoteClickMock.mockReset()
  sendRemoteScrollMock.mockReset()
  sendRemoteKeyboardMock.mockReset()
  sendSpy = vi.spyOn(RemoteInputTransport.prototype, "send")
  handleChannelMessageSpy = vi.spyOn(RemoteInputTransport.prototype, "handleChannelMessage")
})

afterEach(() => {
  sendSpy.mockRestore()
  handleChannelMessageSpy.mockRestore()
})

describe("sendPeerVideoClick", () => {
  it("delegates to the remote input transport with a remote-click message", () => {
    const session = new CallSession("room-1", vi.fn())
    const click = samplePeerVideoClick
    session.sendPeerVideoClick(click)
    expect(sendSpy).toHaveBeenCalledWith({ type: "remote-click", click })
    expect(signalingSend).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "peer-video-click" })
    )
  })
})

describe("sendPeerVideoScroll", () => {
  it("delegates to the remote input transport", () => {
    const session = new CallSession("room-1", vi.fn())
    const scroll = samplePeerVideoScroll
    session.sendPeerVideoScroll(scroll)
    expect(sendSpy).toHaveBeenCalledWith({ type: "remote-scroll", scroll })
  })
})

describe("sendPeerKeyboardInput", () => {
  it("delegates to the remote input transport", () => {
    const session = new CallSession("room-1", vi.fn())
    const keyboard = samplePeerKeyboardInput
    session.sendPeerKeyboardInput(keyboard)
    expect(sendSpy).toHaveBeenCalledWith({ type: "remote-keyboard", keyboard })
  })
})

describe("PeerConnection channel message forwarding", () => {
  it("forwards PeerConnection channel messages straight to the transport", () => {
    new CallSession("room-1", vi.fn())
    capturedPeerConnectionCallbacksRef.value!.onChannelMessage("input", "anything")
    expect(handleChannelMessageSpy).toHaveBeenCalledWith("input", "anything")
  })

  it("dispatches a transport message to the extension bridge when sharing a tab", async () => {
    handleChannelMessageSpy.mockRestore()
    useCallStore.setState({ isScreenSharing: true, screenShareSurface: "browser" })
    sendRemoteClickMock.mockResolvedValue({
      ok: true,
      type: "remote-click-applied",
      targetTabId: 7,
    })
    new CallSession("room-1", vi.fn())
    const click = samplePeerVideoClick
    capturedPeerConnectionCallbacksRef.value!.onChannelMessage(
      "input",
      JSON.stringify({ type: "remote-click", click })
    )
    await Promise.resolve()
    expect(sendRemoteClickMock).toHaveBeenCalledWith(click)
  })
})

describe("PeerConnection constructor args", () => {
  it("constructs PeerConnection with RemoteInputTransport.CHANNEL_SPECS", () => {
    new CallSession("room-1", vi.fn())
    expect(PeerConnectionConstructorSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      RemoteInputTransport.CHANNEL_SPECS
    )
  })
})

describe("peer media mode signaling", () => {
  beforeEach(() => {
    useCallStore.getState().reset()
  })

  it("announces camera mode when the session starts without local screen share", async () => {
    const session = new CallSession("room-1", vi.fn())
    await session.start()
    expect(signalingSend).toHaveBeenCalledWith({ type: "peer-media-mode", mode: "camera" })
  })

  it("announces screen mode when local screen share is already active", async () => {
    useCallStore.setState({ isScreenSharing: true })
    const session = new CallSession("room-1", vi.fn())
    await session.start()
    expect(signalingSend).toHaveBeenCalledWith({ type: "peer-media-mode", mode: "screen" })
  })

  it("stores inbound peer-media-mode messages without forwarding them into the machine", async () => {
    machineHandleProtocolMessage.mockResolvedValue(undefined)
    const session = new CallSession("room-1", vi.fn())

    await (session as unknown as { handleMessage(msg: unknown): Promise<void> }).handleMessage({
      type: "peer-media-mode",
      mode: "screen",
    })

    expect(useCallStore.getState().remoteMediaMode).toBe("screen")
    expect(machineHandleProtocolMessage).not.toHaveBeenCalledWith({
      type: "peer-media-mode",
      mode: "screen",
    })
  })

  it("clears remoteMediaMode on teardown", () => {
    useCallStore.setState({ remoteMediaMode: "screen" })
    const session = new CallSession("room-1", vi.fn())

    session.teardown()

    expect(useCallStore.getState().remoteMediaMode).toBe("unknown")
  })

  it("re-announces the current media mode after a peer-reconnected path", async () => {
    useCallStore.setState({ isScreenSharing: true })
    machineHandleProtocolMessage.mockImplementation(async () => undefined)

    const session = new CallSession("room-1", vi.fn())

    await (session as unknown as { handleMessage(msg: unknown): Promise<void> }).handleMessage({
      type: "peer-reconnected",
    })

    expect(signalingSend).toHaveBeenCalledWith({ type: "peer-media-mode", mode: "screen" })
  })
})

describe("analytics reconnect events", () => {
  it("call_reconnecting emitted with attempt + delayMs", async () => {
    const session = new CallSession("room1", vi.fn())
    await session.start()

    capturedSignalingCallbacksRef.value!.onReconnecting(2, 4000)

    expect(trackMock).toHaveBeenCalledWith("call_reconnecting", { attempt: 2, delayMs: 4000 })
  })
})

describe("analytics call lifecycle events", () => {
  function callEndedEvents() {
    return trackMock.mock.calls.filter((call) => call[0] === "call_ended")
  }

  it("call_ended does not emit when session never became endable", () => {
    const session = new CallSession("room1", vi.fn())

    session.teardown("unmount")

    expect(callEndedEvents()).toHaveLength(0)
  })

  it("call_started fires at start()", async () => {
    const session = new CallSession("room1", vi.fn())

    await session.start()

    expect(trackMock).toHaveBeenCalledWith("call_started", { roomId: "room1" })
  })

  it("call_ended fires once with first reason (terminal then unmount)", async () => {
    const session = new CallSession("room1", vi.fn())
    await session.start()

    ;(session as unknown as { handleTerminalClose(code: number): void }).handleTerminalClose(4002)
    session.teardown("unmount")

    const ended = callEndedEvents()
    expect(ended).toHaveLength(1)
    expect(ended[0][1]).toMatchObject({ reason: "peer_disconnected" })
  })

  it.each([
    [4001, "room_full"],
    [4002, "peer_disconnected"],
    [4003, "room_not_found"],
    [4004, "duplicate_session"],
    [4005, "ping_timeout"],
    [4999, "unknown_close"],
  ])("close %i -> %s", async (code, reason) => {
    const session = new CallSession("room1", vi.fn())
    await session.start()

    ;(session as unknown as { handleTerminalClose(code: number): void }).handleTerminalClose(code)

    expect(trackMock).toHaveBeenCalledWith(
      "call_ended",
      expect.objectContaining({ reason }),
      expect.anything()
    )
  })

  it("onMaxRetriesExceeded emits connect_failed exactly once", async () => {
    const session = new CallSession("room1", vi.fn())
    await session.start()

    capturedSignalingCallbacksRef.value!.onMaxRetriesExceeded(3)

    const ended = callEndedEvents()
    expect(ended).toHaveLength(1)
    expect(ended[0][1]).toMatchObject({ reason: "connect_failed" })
  })

  it("no call_ended when start() failed before connect, then teardown", async () => {
    mediaInit.mockRejectedValueOnce(new DOMException("x", "NotAllowedError"))
    const session = new CallSession("room1", vi.fn())

    await session.start()
    session.teardown("unmount")

    expect(callEndedEvents()).toHaveLength(0)
  })

  it("media_error emitted with DOMException name when still alive", async () => {
    mediaInit.mockRejectedValueOnce(new DOMException("x", "NotAllowedError"))
    signalingState.isAlive = true
    const session = new CallSession("room1", vi.fn())

    await session.start()

    expect(trackMock).toHaveBeenCalledWith("media_error", { errorName: "NotAllowedError" })
  })

  it("media_error NOT emitted when session no longer alive", async () => {
    mediaInit.mockRejectedValueOnce(new DOMException("x", "NotAllowedError"))
    signalingState.isAlive = false
    const session = new CallSession("room1", vi.fn())

    await session.start()

    expect(trackMock).not.toHaveBeenCalledWith("media_error", expect.anything())
  })

  it("hangup emits call_ended with hangup exactly once", async () => {
    const session = new CallSession("room1", vi.fn())
    await session.start()

    session.hangup()

    const ended = callEndedEvents()
    expect(ended).toHaveLength(1)
    expect(ended[0][1]).toMatchObject({ reason: "hangup" })
  })

  it("pagehide persisted=false after start emits tab_closed via beacon", async () => {
    const session = new CallSession("room1", vi.fn())
    await session.start()

    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }))

    expect(trackMock).toHaveBeenCalledWith(
      "call_ended",
      expect.objectContaining({ reason: "tab_closed" }),
      { beacon: true }
    )
  })

  it("pagehide during media permission wait emits tab_closed via beacon", () => {
    mediaInit.mockReturnValueOnce(new Promise(() => undefined))
    const session = new CallSession("room1", vi.fn())

    void session.start()
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }))

    expect(trackMock).toHaveBeenCalledWith(
      "call_ended",
      expect.objectContaining({ reason: "tab_closed", wasConnected: false }),
      { beacon: true }
    )
  })

  it("pagehide during media permission wait prevents later connect", async () => {
    let resolveMedia: (stream: unknown) => void = () => {}
    mediaInit.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveMedia = resolve
      })
    )
    const session = new CallSession("room1", vi.fn())

    const start = session.start()
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }))
    resolveMedia({ getTracks: () => [] })
    await start

    expect(capturedSignalingCallbacksRef.value).not.toBeNull()
    expect(signalingSend).not.toHaveBeenCalled()
  })

  it("pagehide during media permission wait prevents later media_error", async () => {
    let rejectMedia: (error: unknown) => void = () => {}
    mediaInit.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectMedia = reject
      })
    )
    const session = new CallSession("room1", vi.fn())

    const start = session.start()
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }))
    rejectMedia(new DOMException("x", "NotAllowedError"))
    await start

    expect(trackMock).not.toHaveBeenCalledWith("media_error", expect.anything())
  })

  it("pagehide persisted=true (bfcache) emits nothing", async () => {
    const session = new CallSession("room1", vi.fn())
    await session.start()

    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }))

    expect(callEndedEvents()).toHaveLength(0)
  })

  it("pagehide before connect (not endable) emits nothing", () => {
    new CallSession("room1", vi.fn())

    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }))

    expect(callEndedEvents()).toHaveLength(0)
  })

  it("teardown removes the pagehide listener", async () => {
    const session = new CallSession("room1", vi.fn())
    await session.start()
    session.teardown("unmount")
    trackMock.mockClear()

    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }))

    expect(trackMock).not.toHaveBeenCalled()
  })

  it("call_connected emitted once even across ICE restart", async () => {
    const session = new CallSession("room1", vi.fn())
    await session.start()
    const { onConnected } = capturedMachineDepsRef.value as { onConnected: () => void }

    onConnected()
    onConnected()

    const calls = trackMock.mock.calls.filter((call) => call[0] === "call_connected")
    expect(calls).toHaveLength(1)
    expect(calls[0][1]).toMatchObject({ roomId: "room1" })
    expect(typeof (calls[0][1] as { msToConnect: number }).msToConnect).toBe("number")
  })
})
