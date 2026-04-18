// src/lib/call/CallSession.ts
import { MediaController } from "./MediaController"
import { PeerConnection } from "./PeerConnection"
import { SignalingChannel } from "./SignalingChannel"
import { useCallStore } from "@/store/call"
import { getPeerId } from "@/lib/peerId"
import { CLOSE_CODES } from "@/types/signaling"
import type { ReceivedMessage } from "@/types/signaling"
import { reduce } from "./signalingReducer"
import type { SignalingAction } from "./signalingReducer"

type NavigateFn = (path: string) => void

const WS_URL = import.meta.env.VITE_WS_URL as string

// ── CallSession ───────────────────────────────────────────────────────────────

export class CallSession {
  readonly roomId: string
  readonly media: MediaController
  private readonly navigate: NavigateFn
  private readonly peerConnection: PeerConnection
  private readonly signalingChannel: SignalingChannel

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
        onStatusChange: (status) => useCallStore.setState({ status }),
      }
    )

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

  // ── Signaling message dispatch ──────────────────────────────────────────────

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

  private runAction(action: SignalingAction): Promise<void> | void {
    if (action.type === "SET_STATUS") {
      useCallStore.setState({ status: action.status })
      return
    }
    if (action.type === "SETUP_PC") {
      this.peerConnection.setup(action.role)
      const pc = this.peerConnection.raw!
      useCallStore.setState({ pc, role: action.role })
      this.media.attachPC(pc)
      return
    }
    if (action.type === "RESTART_ICE") {
      this.peerConnection.restartIce()
      return
    }
    if (action.type === "ROLLBACK_AND_RESTART_ICE") {
      return this.peerConnection.rollbackAndRestartIce()
    }
    if (action.type === "SEND_WS") {
      this.signalingChannel.send(action.msg)
      return
    }
    if (action.type === "HANDLE_OFFER") {
      return this.peerConnection.handleOffer(action.offer)
    }
    if (action.type === "HANDLE_ANSWER") {
      return this.peerConnection.handleAnswer(action.answer)
    }
    if (action.type === "HANDLE_ICE_CANDIDATE") {
      return this.peerConnection.handleIceCandidate(action.candidate)
    }
    if (action.type === "WARN") {
      console.warn("[Signaling]", action.message)
      return
    }

    const _exhaustiveCheck: never = action
    void _exhaustiveCheck
  }

  private async handleMessage(msg: ReceivedMessage) {
    const actions = reduce(this.peerConnection.state, msg)
    for (const action of actions) {
      const result = this.runAction(action)
      if (result instanceof Promise) {
        await result
      }
    }
  }
}
