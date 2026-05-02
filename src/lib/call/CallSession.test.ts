import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest"
import { useCallStore } from "@/store/call"
import { samplePeerKeyboardInput } from "@/testing/peerKeyboardInput.fixture"
import { samplePeerVideoClick } from "@/testing/peerVideoClick.fixture"
import { samplePeerVideoScroll } from "@/testing/peerVideoScroll.fixture"
import { CallSession } from "./CallSession"
import type { PeerConnectionCallbacks } from "./PeerConnection"
import { RemoteInputTransport } from "./RemoteInputTransport"

const {
  sendRemoteClickMock,
  sendRemoteScrollMock,
  sendRemoteKeyboardMock,
  signalingSend,
  machineHandleProtocolMessage,
  mockedPeerConnection,
  PeerConnectionConstructorSpy,
  capturedPeerConnectionCallbacksRef,
} = vi.hoisted(() => {
  const capturedPeerConnectionCallbacksRef: { value: PeerConnectionCallbacks | null } = {
    value: null,
  }
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
      init: vi.fn(),
      teardown: vi.fn(),
      attachPC: vi.fn(),
    }
  }),
}))

vi.mock("./PeerConnection", () => ({
  PeerConnection: PeerConnectionConstructorSpy,
}))

vi.mock("./SignalingMachine", () => ({
  SignalingMachine: vi.fn().mockImplementation(function SignalingMachineMock() {
    return {
      handleProtocolMessage: machineHandleProtocolMessage,
      send: vi.fn(),
    }
  }),
}))

vi.mock("./SignalingChannel", () => ({
  SignalingChannel: vi.fn().mockImplementation(function SignalingChannelMock() {
    return {
      send: signalingSend,
      connect: vi.fn(),
      close: vi.fn(),
      isAlive: true,
    }
  }),
}))

let sendSpy: MockInstance<RemoteInputTransport["send"]>
let handleChannelMessageSpy: MockInstance<RemoteInputTransport["handleChannelMessage"]>

beforeEach(() => {
  capturedPeerConnectionCallbacksRef.value = null
  mockedPeerConnection.sendOnChannel.mockReset()
  mockedPeerConnection.sendOnChannel.mockReturnValue(true)
  signalingSend.mockReset()
  machineHandleProtocolMessage.mockReset()
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

    await (session as never).handleMessage({ type: "peer-media-mode", mode: "screen" })

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
})
