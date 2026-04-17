// src/lib/call/CallSession.ts
import { MediaController } from './MediaController'
import { useCallStore } from '@/store/call'
import { getPeerId } from '@/lib/peerId'
import { CLOSE_CODES } from '@/types/signaling'
import type { ClientMessage, ReceivedMessage } from '@/types/signaling'
import { reduce } from './signalingReducer'
import type { SignalingAction } from './signalingReducer'

type NavigateFn = (path: string) => void

const WS_URL = import.meta.env.VITE_WS_URL as string
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]
const MAX_WS_ATTEMPTS = 3

// ── CallSession ───────────────────────────────────────────────────────────────

export class CallSession {
  readonly roomId: string
  readonly media: MediaController
  private readonly navigate: NavigateFn

  private ws: WebSocket | null = null
  private pc: RTCPeerConnection | null = null

  private pendingCandidates: RTCIceCandidateInit[] = []
  private remoteDescriptionSet = false
  private makingOffer = false
  private role: 'caller' | 'callee' | null = null

  private wsAttempts = 0
  private reconnectDelay = 1000
  private reconnectTimer?: ReturnType<typeof setTimeout>
  private alive = true

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  constructor(roomId: string, navigate: NavigateFn) {
    this.roomId = roomId
    this.navigate = navigate
    this.media = new MediaController()
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
    this.pc?.close()
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
    return {
      role: this.role,
      makingOffer: this.makingOffer,
      signalingState: this.pc?.signalingState ?? null,
    }
  }

  private runAction(action: SignalingAction): Promise<void> | void {
    if (action.type === 'SET_STATUS') {
      useCallStore.setState({ status: action.status })
      return
    }
    if (action.type === 'SETUP_PC') {
      this.setupPC(action.role)
      return
    }
    if (action.type === 'RESTART_ICE') {
      this.pc?.restartIce()
      return
    }
    if (action.type === 'ROLLBACK_AND_RESTART_ICE') {
      if (this.pc) {
        return this.pc.setLocalDescription({ type: 'rollback' }).then(() => {
          this.pc?.restartIce()
        })
      }
      return
    }
    if (action.type === 'SEND_WS') {
      this.send(action.msg)
      return
    }
    if (action.type === 'HANDLE_OFFER') {
      return this.handleOffer(action.offer)
    }
    if (action.type === 'HANDLE_ANSWER') {
      return this.handleAnswer(action.answer)
    }
    if (action.type === 'HANDLE_ICE_CANDIDATE') {
      return this.handleIceCandidate(action.candidate)
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

  // ── RTCPeerConnection ───────────────────────────────────────────────────────

  private setupPC(role: 'caller' | 'callee') {
    this.pc?.close()
    this.role = role
    this.remoteDescriptionSet = false
    this.pendingCandidates = []

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    this.pc = pc
    useCallStore.setState({ pc, role })

    this.media.attachPC(pc)

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.send({ type: 'ice-candidate', candidate: e.candidate.toJSON() })
      }
    }

    pc.ontrack = (e) => {
      useCallStore.setState({ remoteStream: e.streams[0] ?? null })
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        useCallStore.setState({ status: 'connected' })
      } else if (pc.iceConnectionState === 'failed') {
        useCallStore.setState({ status: 'reconnecting' })
        if (role === 'caller') pc.restartIce()
      }
    }

    pc.onnegotiationneeded = async () => {
      if (this.role === 'callee') return
      try {
        this.makingOffer = true
        await pc.setLocalDescription()
        this.send({ type: 'offer', offer: pc.localDescription! })
      } finally {
        this.makingOffer = false
      }
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit) {
    const pc = this.pc
    if (!pc) return
    const collision = this.makingOffer || pc.signalingState !== 'stable'
    if (this.role !== 'callee' && collision) return
    await this.applyOffer(pc, offer)
  }

  private async applyOffer(pc: RTCPeerConnection, offer: RTCSessionDescriptionInit) {
    if (pc.signalingState !== 'stable') {
      await pc.setLocalDescription({ type: 'rollback' })
    }
    await pc.setRemoteDescription(offer)
    this.remoteDescriptionSet = true
    await this.drainCandidates()
    await pc.setLocalDescription()
    this.send({ type: 'answer', answer: pc.localDescription! })
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit) {
    const pc = this.pc
    if (!pc) return
    await pc.setRemoteDescription(answer)
    this.remoteDescriptionSet = true
    await this.drainCandidates()
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit) {
    if (this.remoteDescriptionSet && this.pc) {
      await this.pc.addIceCandidate(candidate)
    } else {
      this.pendingCandidates.push(candidate)
    }
  }

  private async drainCandidates() {
    if (!this.pc) return
    for (const c of this.pendingCandidates) {
      try {
        await this.pc.addIceCandidate(c)
      } catch {
        // Stale candidate from a previous offer/answer (mismatched ICE ufrag) — safe to skip
      }
    }
    this.pendingCandidates = []
  }

  // ── Public actions ──────────────────────────────────────────────────────────

  hangup() {
    this.teardown('hangup')
    this.navigate(`/room/${this.roomId}/ended`)
  }

}
