// src/lib/call/CallSession.ts
import { MediaController } from './MediaController'
import { PeerConnection } from './PeerConnection'
import { useCallStore } from '@/store/call'
import { getPeerId } from '@/lib/peerId'
import { CLOSE_CODES } from '@/types/signaling'
import type { ClientMessage, ReceivedMessage } from '@/types/signaling'
import { reduce } from './signalingReducer'
import type { SignalingAction } from './signalingReducer'

type NavigateFn = (path: string) => void

const WS_URL = import.meta.env.VITE_WS_URL as string
const MAX_WS_ATTEMPTS = 3

// ── CallSession ───────────────────────────────────────────────────────────────

export class CallSession {
  readonly roomId: string
  readonly media: MediaController
  private readonly navigate: NavigateFn
  private readonly peerConnection: PeerConnection

  private ws: WebSocket | null = null

  private wsAttempts = 0
  private reconnectDelay = 1000
  private reconnectTimer?: ReturnType<typeof setTimeout>
  private alive = true

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  constructor(roomId: string, navigate: NavigateFn) {
    this.roomId = roomId
    this.navigate = navigate
    this.media = new MediaController()
    this.peerConnection = new PeerConnection(
      { send: (msg) => this.send(msg) },
      {
        onRemoteStream: (stream) => useCallStore.setState({ remoteStream: stream }),
        onStatusChange: (status) => useCallStore.setState({ status }),
      },
    )
  }

  async start() {
    const peerId = getPeerId(this.roomId)
    useCallStore.setState({ peerId })
    try {
      const stream = await this.media.init()
      if (!this.alive) {
        this.media.teardown()
        return
      }
      useCallStore.setState({ localStream: stream as MediaStream })
      this.connectWS()
    } catch (e) {
      if (!this.alive) return
      console.error("[Media Devices] We can't get the stream", e)
      useCallStore.setState({ error: 'Camera and microphone access is required to join a call.' })
    }
  }

  teardown(reason: 'unmount' | 'hangup' = 'unmount') {
    this.alive = false
    if (this.reconnectTimer !== undefined) clearTimeout(this.reconnectTimer)
    const { remoteStream } = useCallStore.getState()
    remoteStream?.getTracks().forEach((t) => t.stop())
    this.media.teardown()
    this.ws?.close(1000, reason)
    this.peerConnection.close()
    useCallStore.getState().reset()
  }

  // ── WebSocket ───────────────────────────────────────────────────────────────

  private connectWS() {
    console.debug("[Websocket] We are connecting to the websocket")
    console.trace()
    const peerId = getPeerId(this.roomId)
    const url = `${WS_URL}?room=${this.roomId}&peerId=${peerId}`
    const ws = new WebSocket(url)
    this.ws = ws
    useCallStore.setState({ ws, status: 'connecting' })

    ws.onopen = () => {
      this.reconnectDelay = 1000
      this.wsAttempts = 0
    }

    ws.onmessage = async (e: MessageEvent<string>) => {
      let msg: ReceivedMessage
      try {
        msg = JSON.parse(e.data) as ReceivedMessage
      } catch (err) {
        console.error('[WS] bad payload', e.data, err)
        return
      }
      await this.handleMessage(msg)
    }

    ws.onclose = (e: CloseEvent) => {
      console.debug("[Websocket] The websocket is closed", e.reason, e)
      if (e.code === 1000) return
      const handled = this.handleCloseCode(e.code)
      if (!handled) this.scheduleReconnect(`close code ${e.code}`)
    }
  }

  private send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  private scheduleReconnect(reason: string) {
    this.wsAttempts++
    if (this.wsAttempts >= MAX_WS_ATTEMPTS) {
      console.error("We can't connect to the server")
      useCallStore.setState({ error: 'Unable to connect to the server.' })
      return
    }
    console.warn('[WS] reconnecting', { attempt: this.wsAttempts, delay: this.reconnectDelay, reason })
    useCallStore.setState({ status: 'reconnecting' })
    this.reconnectTimer = setTimeout(() => {
      if (this.alive) this.connectWS()
    }, this.reconnectDelay)
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 8_000)
  }

  private handleCloseCode(code: number): boolean {
    const handlers: Record<number, () => void> = {
      [CLOSE_CODES.ROOM_FULL]: () =>
        useCallStore.setState({ error: 'This room is full. Only two participants are allowed.' }),
      [CLOSE_CODES.PEER_DISCONNECTED]: () =>
        this.navigate(`/room/${this.roomId}/ended`),
      [CLOSE_CODES.ROOM_NOT_FOUND]: () =>
        useCallStore.setState({ error: "This room doesn't exist." }),
      [CLOSE_CODES.DUPLICATE_SESSION]: () =>
        useCallStore.setState({ error: "You're connected to this room from another tab." }),
    }
    const handler = handlers[code]
    if (handler) { handler(); return true }
    
    if (code >= 4000) {
      console.error('[WS] unknown close code', code)
      useCallStore.setState({ error: 'Connection lost unexpectedly.' })
      return true
    }

    return false
  }

  // ── Signaling message dispatch ──────────────────────────────────────────────

  private getSignalingState() {
    return this.peerConnection.state
  }

  private runAction(action: SignalingAction): Promise<void> | void {
    if (action.type === 'SET_STATUS') {
      useCallStore.setState({ status: action.status })
      return
    }
    if (action.type === 'SETUP_PC') {
      this.peerConnection.setup(action.role)
      const pc = this.peerConnection.raw!
      useCallStore.setState({ pc, role: action.role })
      this.media.attachPC(pc)
      return
    }
    if (action.type === 'RESTART_ICE') {
      this.peerConnection.restartIce()
      return
    }
    if (action.type === 'ROLLBACK_AND_RESTART_ICE') {
      return this.peerConnection.rollbackAndRestartIce()
    }
    if (action.type === 'SEND_WS') {
      this.send(action.msg)
      return
    }
    if (action.type === 'HANDLE_OFFER') {
      return this.peerConnection.handleOffer(action.offer)
    }
    if (action.type === 'HANDLE_ANSWER') {
      return this.peerConnection.handleAnswer(action.answer)
    }
    if (action.type === 'HANDLE_ICE_CANDIDATE') {
      return this.peerConnection.handleIceCandidate(action.candidate)
    }
    if (action.type === 'WARN') {
      console.warn('[Signaling]', action.message)
      return
    }

    // Exhaustive check: ensures TypeScript warns us if we forget to handle a new SignalingAction type
    const _exhaustiveCheck: never = action
  }

  private async handleMessage(msg: ReceivedMessage) {
    const actions = reduce(this.getSignalingState(), msg)
    for (const action of actions) {
      const result = this.runAction(action)
      if (result instanceof Promise) {
        await result
      }
    }
  }

  // ── Public actions ──────────────────────────────────────────────────────────

  hangup() {
    this.teardown('hangup')
    this.navigate(`/room/${this.roomId}/ended`)
  }

}
