import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReceivedMessage } from "@/types/signaling"
import { CallSession } from "./CallSession"

const signalingSend = vi.fn()
const machineHandleProtocolMessage = vi.fn()
let signalingCallbacks:
  | {
      onMessage: (msg: ReceivedMessage) => Promise<void>
    }
  | null = null

const sampleClick = {
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
})

describe("sendPeerVideoClick", () => {
  it("sends the click payload through the signaling channel", () => {
    const session = new CallSession("room-1", vi.fn())

    session.sendPeerVideoClick(sampleClick)

    expect(signalingSend).toHaveBeenCalledWith({
      type: "peer-video-click",
      click: sampleClick,
    })
  })
})

describe("incoming peer video click relay", () => {
  it("logs the payload instead of forwarding it to the FSM", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

    new CallSession("room-1", vi.fn())
    await signalingCallbacks?.onMessage({ type: "peer-video-click", click: sampleClick })

    expect(consoleSpy).toHaveBeenCalledWith("[Peer Video Click]", sampleClick)
    expect(machineHandleProtocolMessage).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it("still forwards normal signaling messages to the FSM", async () => {
    new CallSession("room-1", vi.fn())
    await signalingCallbacks?.onMessage({ type: "ping" })

    expect(machineHandleProtocolMessage).toHaveBeenCalledWith({ type: "ping" })
  })
})
