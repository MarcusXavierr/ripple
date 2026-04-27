// src/lib/call/CallSession.ts

import type {
  PeerKeyboardInput,
  PeerVideoClick,
  PeerVideoScroll,
  RemoteInputMessage,
} from "@shared/remoteInputProtocol"
import { getPeerId } from "@/lib/peerId"
import { extensionBridge } from "@/platform/extensionBridge"
import { useCallStore } from "@/store/call"
import type { ReceivedMessage } from "@/types/signaling"
import { CLOSE_CODES } from "@/types/signaling"
import { MediaController } from "./MediaController"
import { PeerConnection } from "./PeerConnection"
import { RemoteInputTransport } from "./RemoteInputTransport"
import { SignalingChannel } from "./SignalingChannel"
import { SignalingMachine } from "./SignalingMachine"

type NavigateFn = (path: string) => void

const WS_URL = import.meta.env.VITE_WS_URL as string

// ── CallSession ───────────────────────────────────────────────────────────────

export class CallSession {
  readonly roomId: string
  readonly media: MediaController
  private readonly navigate: NavigateFn
  private readonly peerConnection: PeerConnection
  private readonly signalingChannel: SignalingChannel
  private readonly machine: SignalingMachine
  private readonly remoteInput: RemoteInputTransport

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  constructor(roomId: string, navigate: NavigateFn) {
    this.roomId = roomId
    this.navigate = navigate
    this.media = new MediaController()

    const peerId = getPeerId(roomId)
    const wsUrl = `${WS_URL}?room=${roomId}&peerId=${peerId}`

    this.peerConnection = new PeerConnection(
      { send: (msg) => this.signalingChannel.send(msg) },
      {
        onRemoteStream: (stream) => useCallStore.setState({ remoteStream: stream }),
        onIceConnected: () => this.machine.send({ type: "ice-connected" }),
        onIceFailed: () => this.machine.send({ type: "ice-failed" }),
        onChannelOpen: (label) => console.debug(`[CallSession] ${label} channel open`),
        onChannelClose: (label) => console.debug(`[CallSession] ${label} channel closed`),
        onChannelMessage: (label, data) => this.remoteInput.handleChannelMessage(label, data),
      },
      RemoteInputTransport.CHANNEL_SPECS
    )

    this.remoteInput = new RemoteInputTransport(this.peerConnection)
    this.remoteInput.onMessage((msg) => {
      void this.dispatchRemoteInputToExtension(msg)
    })

    this.signalingChannel = new SignalingChannel(wsUrl, {
      onMessage: (msg) => this.handleMessage(msg),
      onConnecting: () => useCallStore.setState({ status: "connecting" }),
      onReconnecting: () => useCallStore.setState({ status: "reconnecting" }),
      onTerminalClose: (code) => this.handleTerminalClose(code),
      onMaxRetriesExceeded: () => {
        console.error("[WS] can't connect to the server")
        useCallStore.setState({ error: "Unable to connect to the server." })
      },
    })

    this.machine = new SignalingMachine({
      pc: this.peerConnection,
      ws: this.signalingChannel,
      media: this.media,
      store: useCallStore,
      navigate,
    })
  }

  async start() {
    useCallStore.setState({ peerId: getPeerId(this.roomId) })
    try {
      const stream = await this.media.init()
      if (!this.signalingChannel.isAlive) {
        this.media.teardown()
        return
      }
      useCallStore.setState({ localStream: stream as MediaStream })
      this.signalingChannel.connect()
    } catch (e) {
      if (!this.signalingChannel.isAlive) return
      console.error("[Media Devices] We can't get the stream", e)
      useCallStore.setState({ error: "Camera and microphone access is required to join a call." })
    }
  }

  teardown(reason: "unmount" | "hangup" = "unmount") {
    const { remoteStream } = useCallStore.getState()
    remoteStream?.getTracks().forEach((t) => t.stop())
    this.media.teardown()
    this.signalingChannel.close(1000, reason)
    this.peerConnection.close()
    useCallStore.getState().reset()
  }

  // ── Public actions ──────────────────────────────────────────────────────────

  hangup() {
    this.teardown("hangup")
    this.navigate(`/room/${this.roomId}/ended`)
  }

  sendPeerVideoClick(click: PeerVideoClick) {
    this.remoteInput.send({ type: "remote-click", click })
  }

  sendPeerVideoScroll(scroll: PeerVideoScroll) {
    this.remoteInput.send({ type: "remote-scroll", scroll })
  }

  sendPeerKeyboardInput(keyboard: PeerKeyboardInput) {
    this.remoteInput.send({ type: "remote-keyboard", keyboard })
  }

  // ── Signaling message dispatch ──────────────────────────────────────────────

  private canForwardRemoteInputToExtension(kind: "click" | "scroll" | "keyboard"): boolean {
    const { isScreenSharing, screenShareSurface } = useCallStore.getState()
    if (!isScreenSharing) {
      console.debug(
        `[Ripple Extension] skipping remote ${kind} because local peer is not screen sharing`
      )
      return false
    }
    if (screenShareSurface !== "browser") {
      console.debug(
        `[Ripple Extension] skipping remote ${kind} because local peer is not sharing a tab`
      )
      return false
    }
    return true
  }

  private async dispatchRemoteInputToExtension(msg: RemoteInputMessage): Promise<void> {
    if (msg.type === "remote-click") {
      if (!this.canForwardRemoteInputToExtension("click")) return
      await extensionBridge.sendRemoteClick(msg.click)
      return
    }
    if (msg.type === "remote-scroll") {
      if (!this.canForwardRemoteInputToExtension("scroll")) return
      await extensionBridge.sendRemoteScroll(msg.scroll)
      return
    }
    if (msg.type === "remote-keyboard") {
      if (!this.canForwardRemoteInputToExtension("keyboard")) return
      void extensionBridge.sendRemoteKeyboard(msg.keyboard)
      return
    }
  }

  private handleMessage(msg: ReceivedMessage): Promise<void> {
    return this.machine.handleProtocolMessage(msg) ?? Promise.resolve()
  }

  private handleTerminalClose(code: number): void {
    const handlers: Record<number, () => void> = {
      [CLOSE_CODES.ROOM_FULL]: () =>
        useCallStore.setState({ error: "This room is full. Only two participants are allowed." }),
      [CLOSE_CODES.PEER_DISCONNECTED]: () => this.navigate(`/room/${this.roomId}/ended`),
      [CLOSE_CODES.ROOM_NOT_FOUND]: () =>
        useCallStore.setState({ error: "This room doesn't exist." }),
      [CLOSE_CODES.DUPLICATE_SESSION]: () =>
        useCallStore.setState({ error: "You're connected to this room from another tab." }),
    }
    const handler = handlers[code]
    if (handler) {
      handler()
      return
    }
    console.error("[WS] unknown close code", code)
    useCallStore.setState({ error: "Connection lost unexpectedly." })
  }
}
