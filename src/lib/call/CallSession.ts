// src/lib/call/CallSession.ts
import { useCallStore } from '@/store/call'
import { getPeerId } from '@/lib/peerId'
import { CLOSE_CODES } from '@/types/signaling'
import type { ClientMessage, ReceivedMessage } from '@/types/signaling'

type NavigateFn = (path: string) => void

const WS_URL = import.meta.env.VITE_WS_URL as string
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]
const MAX_WS_ATTEMPTS = 3

// ── Module-level registry (one session per roomId) ────────────────────────────

interface RegistryEntry {
  session: CallSession
  count: number
  teardownTimer?: ReturnType<typeof setTimeout>
}

const sessions = new Map<string, RegistryEntry>()

// ── CallSession ───────────────────────────────────────────────────────────────

export class CallSession {
  readonly roomId: string
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

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  static acquire(roomId: string, navigate: NavigateFn): CallSession {
    const entry = sessions.get(roomId)
    if (entry) {
      if (entry.teardownTimer !== undefined) {
        clearTimeout(entry.teardownTimer)
        entry.teardownTimer = undefined
      }
      entry.count++
      return entry.session
    }
    const session = new CallSession(roomId, navigate)
    sessions.set(roomId, { session, count: 1 })
    session.start()
    return session
  }

  release() {
    const entry = sessions.get(this.roomId)
    if (!entry) return
    entry.count--
    if (entry.count === 0) {
      entry.teardownTimer = setTimeout(() => {
        this.teardown()
        sessions.delete(this.roomId)
      }, 0)
    }
  }

  /** Test helper: clear all sessions without teardown. */
  static __resetForTests() {
    sessions.clear()
  }

  private constructor(roomId: string, navigate: NavigateFn) {
    this.roomId = roomId
    this.navigate = navigate
  }

  private start() {
    const peerId = getPeerId(this.roomId)
    useCallStore.setState({ peerId })
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (!sessions.has(this.roomId)) {
          stream.getTracks().forEach((t) => t.stop())
          console.debug("[Session] We didn't found the session, so we stop the stream")
          return
        }
        useCallStore.setState({ localStream: stream as MediaStream })
        this.connectWS()
      })
      .catch((e) => {
        console.error("[Media Devices] We can't get the stream", e)
        if (!sessions.has(this.roomId)) return
        useCallStore.setState({ error: 'Camera and microphone access is required to join a call.' })
      })
  }

  private teardown() {
    if (this.reconnectTimer !== undefined) clearTimeout(this.reconnectTimer)
    const { localStream, remoteStream } = useCallStore.getState()
    localStream?.getTracks().forEach((t) => t.stop())
    remoteStream?.getTracks().forEach((t) => t.stop())
    this.ws?.close(1000, 'unmount')
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
      const msg = JSON.parse(e.data) as ReceivedMessage
      await this.handleMessage(msg)
    }

    ws.onclose = (e: CloseEvent) => {
      console.debug("[Websocket] The websocket is closed", e.reason, e)
      if (e.code === 1000) return
      const handled = this.handleCloseCode(e.code)
      if (!handled) this.scheduleReconnect()
    }
  }

  private send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  private scheduleReconnect() {
    this.wsAttempts++
    if (this.wsAttempts >= MAX_WS_ATTEMPTS) {
      console.error("We can't connect to the server")
      useCallStore.setState({ error: 'Unable to connect to the server.' })
      return
    }
    useCallStore.setState({ status: 'reconnecting' })
    this.reconnectTimer = setTimeout(() => {
      if (sessions.has(this.roomId)) this.connectWS()
    }, this.reconnectDelay)
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000)
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
    return false
  }

  // ── Signaling message dispatch ──────────────────────────────────────────────

  private async handleMessage(msg: ReceivedMessage) {
    switch (msg.type) {
      case 'onopen':
        this.setupPC(msg.role)
        useCallStore.setState({ status: 'waiting' })
        break
      case 'enter':
        useCallStore.setState({ status: 'negotiating' })
        if (this.role === 'caller' && this.pc) {
          if (this.pc.signalingState !== 'stable') {
            await this.pc.setLocalDescription({ type: 'rollback' })
          }
          this.pc.restartIce()
        }
        break
      case 'peer-reconnected':
        useCallStore.setState({ status: 'negotiating' })
        if (this.role === 'caller') this.pc?.restartIce()
        break
      case 'ping':
        this.send({ type: 'pong' })
        break
      case 'offer':
        await this.handleOffer(msg.offer)
        break
      case 'answer':
        await this.handleAnswer(msg.answer)
        break
      case 'ice-candidate':
        await this.handleIceCandidate(msg.candidate)
        break
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

    // TODO: [Question] Por que caralhos esse localStream é puxado? essa porra não é null sempre? e se não for null nós não fechamos os this.pc.close lá em cima? Isso não vai fazer puxar ngc bichado? Quem seta essa bosta?
    const stream = useCallStore.getState().localStream
    if (stream) {
      console.debug("[Stream] Found local stream, we're adding tracks to the peer connection")
      for (const track of stream.getTracks()) {
        console.debug("[Stream] We're adding track to the peer connection", track.label)
        pc.addTrack(track, stream)
      }
    }

    // TODO: [Debug] eu tô usando a mesma máquina pra testar tanto o caller quanto o callee, pode ser por isso que a porra do onicecandidate tá demorando tanto pra ser triggado pelo segundo otario que entra? o google (Stun server) tá vendo que já mandou essa porra e não manda mais
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

  toggleMic() {
    const track = useCallStore.getState().localStream?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    useCallStore.setState({ isMicMuted: !track.enabled })
  }

  toggleCamera() {
    const track = useCallStore.getState().localStream?.getVideoTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    useCallStore.setState({ isCameraOff: !track.enabled })
  }

  async startScreenShare() {
    const pc = this.pc
    if (!pc) return
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      const screenTrack = screenStream.getVideoTracks()[0]
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
      if (sender) {
        await sender.replaceTrack(screenTrack)
      } else {
        pc.addTrack(screenTrack, screenStream)
      }
      useCallStore.setState({ isScreenSharing: true })
      screenTrack.onended = () => this.stopScreenShare()
    } catch {
      // User cancelled picker — do nothing
    }
  }

  async stopScreenShare() {
    const pc = this.pc
    if (!pc) return
    const cameraTrack = useCallStore.getState().localStream?.getVideoTracks()[0] ?? null
    const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
    const screenTrack = sender?.track ?? null
    if (sender) await sender.replaceTrack(cameraTrack)
    if (screenTrack && screenTrack !== cameraTrack) screenTrack.stop()
    useCallStore.setState({ isScreenSharing: false })
  }

  hangup() {
    const { localStream, remoteStream } = useCallStore.getState()
    localStream?.getTracks().forEach((t) => t.stop())
    remoteStream?.getTracks().forEach((t) => t.stop())
    this.ws?.close(1000, 'hangup')
    this.pc?.close()
    // Remove from registry so teardown doesn't double-close
    sessions.delete(this.roomId)
    this.navigate(`/room/${this.roomId}/ended`)
  }

  dismissError() {
    const err = useCallStore.getState().error
    useCallStore.setState({ error: null })
    if (
      err?.includes('room is full') ||
      err?.includes("doesn't exist") ||
      err?.includes('another tab') ||
      err?.includes('Unable to connect')
    ) {
      this.navigate('/')
    }
  }
}
