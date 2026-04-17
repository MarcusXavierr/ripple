// src/lib/call/PeerConnection.ts
import type { ClientMessage } from '@/types/signaling'
import type { CallStatus } from '@/store/call'
import type { SignalingState } from './signalingReducer'

const ICE_SERVERS: RTCConfiguration['iceServers'] = [{ urls: 'stun:stun.l.google.com:19302' }]

export interface PeerConnectionTransport {
  send(msg: ClientMessage): void
}

export interface PeerConnectionCallbacks {
  onRemoteStream(stream: MediaStream | null): void
  onStatusChange(status: CallStatus): void
}

export class PeerConnection {
  private pc: RTCPeerConnection | null = null
  private pendingCandidates: RTCIceCandidateInit[] = []
  private remoteDescriptionSet = false
  private _makingOffer = false
  private role: 'caller' | 'callee' | null = null

  constructor(
    private readonly transport: PeerConnectionTransport,
    private readonly callbacks: PeerConnectionCallbacks,
  ) {}

  get raw(): RTCPeerConnection | null {
    return this.pc
  }

  get state(): SignalingState {
    return {
      role: this.role,
      makingOffer: this._makingOffer,
      signalingState: this.pc?.signalingState ?? null,
    }
  }

  setup(role: 'caller' | 'callee'): void {
    throw new Error('not implemented')
  }

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    throw new Error('not implemented')
  }

  private async applyOffer(pc: RTCPeerConnection, offer: RTCSessionDescriptionInit) {
    throw new Error('not implemented')
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    throw new Error('not implemented')
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    throw new Error('not implemented')
  }

  private async drainCandidates() {
    throw new Error('not implemented')
  }

  restartIce(): void {
    throw new Error('not implemented')
  }

  async rollbackAndRestartIce(): Promise<void> {
    throw new Error('not implemented')
  }

  close(): void {
    throw new Error('not implemented')
  }
}
