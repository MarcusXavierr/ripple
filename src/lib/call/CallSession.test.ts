import { beforeEach, describe, expect, it, vi } from "vitest"
import { samplePeerVideoClick } from "@/testing/peerVideoClick.fixture"
import { samplePeerVideoScroll } from "@/testing/peerVideoScroll.fixture"
import type { ReceivedMessage } from "@/types/signaling"
import { useCallStore } from "@/store/call"
import { CallSession } from "./CallSession"

const sendRemoteClickMock = vi.fn()
const sendRemoteScrollMock = vi.fn()

vi.mock("@/platform/extensionBridge", () => ({
  extensionBridge: {
    sendRemoteClick: (...args: unknown[]) => sendRemoteClickMock(...args),
    sendRemoteScroll: (...args: unknown[]) => sendRemoteScrollMock(...args),
  },
}))

const signalingSend = vi.fn()
const machineHandleProtocolMessage = vi.fn()
let signalingCallbacks: {
  onMessage: (msg: ReceivedMessage) => Promise<void>
} | null = null

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
  PeerConnection: vi.fn().mockImplementation(function PeerConnectionMock() {
    return {
      raw: null,
      close: vi.fn(),
      setup: vi.fn(),
      handleOffer: vi.fn(),
      handleAnswer: vi.fn(),
      handleIceCandidate: vi.fn(),
      rollbackAndRestartIce: vi.fn(),
    }
  }),
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
  SignalingChannel: vi.fn().mockImplementation(function SignalingChannelMock(
    _url: string,
    callbacks
  ) {
    signalingCallbacks = callbacks
    return {
      send: signalingSend,
      connect: vi.fn(),
      close: vi.fn(),
      isAlive: true,
    }
  }),
}))

beforeEach(() => {
  signalingCallbacks = null
  signalingSend.mockReset()
  machineHandleProtocolMessage.mockReset()
  sendRemoteClickMock.mockReset()
  sendRemoteScrollMock.mockReset()
})

describe("sendPeerVideoClick", () => {
  it("sends the click payload through the signaling channel", () => {
    const session = new CallSession("room-1", vi.fn())

    session.sendPeerVideoClick(samplePeerVideoClick)

    expect(signalingSend).toHaveBeenCalledWith({
      type: "peer-video-click",
      click: samplePeerVideoClick,
    })
  })
})

describe("sendPeerVideoScroll", () => {
  it("sends the scroll payload through the signaling channel", () => {
    const session = new CallSession("room-1", vi.fn())

    session.sendPeerVideoScroll(samplePeerVideoScroll)

    expect(signalingSend).toHaveBeenCalledWith({
      type: "peer-video-scroll",
      scroll: samplePeerVideoScroll,
    })
  })
})

describe("incoming peer video click relay", () => {
  it("does not forward the click to the FSM", async () => {
    new CallSession("room-1", vi.fn())
    await signalingCallbacks?.onMessage({ type: "peer-video-click", click: samplePeerVideoClick })

    expect(machineHandleProtocolMessage).not.toHaveBeenCalled()
  })

  it("still forwards normal signaling messages to the FSM", async () => {
    new CallSession("room-1", vi.fn())
    await signalingCallbacks?.onMessage({ type: "ping" })

    expect(machineHandleProtocolMessage).toHaveBeenCalledWith({ type: "ping" })
  })

  it("forwards inbound peer-video-click to the extension when local peer is screen sharing", async () => {
    const session = new CallSession("room-1", vi.fn())
    useCallStore.setState({ isScreenSharing: true, screenShareSurface: "browser" })
    sendRemoteClickMock.mockResolvedValue({
      ok: true,
      type: "remote-click-applied",
      targetTabId: 7,
    })

    await signalingCallbacks?.onMessage({ type: "peer-video-click", click: samplePeerVideoClick })

    expect(sendRemoteClickMock).toHaveBeenCalledWith(samplePeerVideoClick)
    session.teardown()
  })

  it("does not forward inbound peer-video-click when local peer is not screen sharing", async () => {
    const session = new CallSession("room-1", vi.fn())
    useCallStore.setState({ isScreenSharing: false })

    await signalingCallbacks?.onMessage({ type: "peer-video-click", click: samplePeerVideoClick })

    expect(sendRemoteClickMock).not.toHaveBeenCalled()
    session.teardown()
  })

  it("does not forward inbound peer-video-click when local peer is sharing a window instead of a tab", async () => {
    const session = new CallSession("room-1", vi.fn())
    useCallStore.setState({ isScreenSharing: true, screenShareSurface: "window" })

    await signalingCallbacks?.onMessage({ type: "peer-video-click", click: samplePeerVideoClick })

    expect(sendRemoteClickMock).not.toHaveBeenCalled()
    session.teardown()
  })
})

describe("incoming peer video scroll relay", () => {
  it("does not forward the scroll to the FSM", async () => {
    new CallSession("room-1", vi.fn())
    await signalingCallbacks?.onMessage({
      type: "peer-video-scroll",
      scroll: samplePeerVideoScroll,
    })

    expect(machineHandleProtocolMessage).not.toHaveBeenCalled()
  })

  it("forwards inbound peer-video-scroll to the extension when local peer is sharing a browser tab", async () => {
    const session = new CallSession("room-1", vi.fn())
    useCallStore.setState({ isScreenSharing: true, screenShareSurface: "browser" })
    sendRemoteScrollMock.mockResolvedValue({
      ok: true,
      type: "remote-scroll-applied",
      targetTabId: 7,
    })

    await signalingCallbacks?.onMessage({
      type: "peer-video-scroll",
      scroll: samplePeerVideoScroll,
    })

    expect(sendRemoteScrollMock).toHaveBeenCalledWith(samplePeerVideoScroll)
    session.teardown()
  })

  it("does not forward inbound peer-video-scroll when local peer is not sharing a browser tab", async () => {
    const session = new CallSession("room-1", vi.fn())
    useCallStore.setState({ isScreenSharing: true, screenShareSurface: "window" })

    await signalingCallbacks?.onMessage({
      type: "peer-video-scroll",
      scroll: samplePeerVideoScroll,
    })

    expect(sendRemoteScrollMock).not.toHaveBeenCalled()
    session.teardown()
  })
})
