// src/lib/call/PeerConnection.ts
import type { ClientMessage } from "@/types/signaling"
import type { CallStatus } from "@/store/call"
import type { SignalingState } from "./signalingReducer"

const ICE_SERVERS: RTCConfiguration["iceServers"] = [{ urls: "stun:stun.l.google.com:19302" }]

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
  private role: "caller" | "callee" | null = null

  private readonly transport: PeerConnectionTransport
  private readonly callbacks: PeerConnectionCallbacks

  constructor(transport: PeerConnectionTransport, callbacks: PeerConnectionCallbacks) {
    this.transport = transport
    this.callbacks = callbacks
  }

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

  setup(role: "caller" | "callee"): void {
    this.pc?.close()
    this.role = role
    this.remoteDescriptionSet = false
    this.pendingCandidates = []
    this._makingOffer = false

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    this.pc = pc

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.transport.send({ type: "ice-candidate", candidate: e.candidate.toJSON() })
      }
    }

    pc.ontrack = (e) => {
      this.callbacks.onRemoteStream(e.streams[0] ?? null)
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        this.callbacks.onStatusChange("connected")
      } else if (pc.iceConnectionState === "failed") {
        this.callbacks.onStatusChange("reconnecting")
        if (this.role === "caller") pc.restartIce()
      }
    }

    pc.onnegotiationneeded = async () => {
      if (this.role === "callee") return
      try {
        this._makingOffer = true
        await pc.setLocalDescription()
        this.transport.send({ type: "offer", offer: pc.localDescription! })
      } finally {
        this._makingOffer = false
      }
    }
  }

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.pc
    if (!pc) return
    const collision = this._makingOffer || pc.signalingState !== "stable"
    if (this.role !== "callee" && collision) return
    await this.applyOffer(pc, offer)
  }

  private async applyOffer(pc: RTCPeerConnection, offer: RTCSessionDescriptionInit) {
    if (pc.signalingState !== "stable") {
      await pc.setLocalDescription({ type: "rollback" })
    }
    await pc.setRemoteDescription(offer)
    this.remoteDescriptionSet = true
    await this.drainCandidates()
    await pc.setLocalDescription()
    this.transport.send({ type: "answer", answer: pc.localDescription! })
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.pc
    if (!pc) return
    await pc.setRemoteDescription(answer)
    this.remoteDescriptionSet = true
    await this.drainCandidates()
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
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
        // Stale candidate from a previous offer/answer — safe to skip
      }
    }
    this.pendingCandidates = []
  }

  restartIce(): void {
    this.pc?.restartIce()
  }

  async rollbackAndRestartIce(): Promise<void> {
    if (this.pc) {
      await this.pc.setLocalDescription({ type: "rollback" })
      this.pc.restartIce()
    }
  }

  close(): void {
    this.pc?.close()
  }
}
