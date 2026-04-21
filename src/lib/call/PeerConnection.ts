// src/lib/call/PeerConnection.ts

import type { ClientMessage } from "@/types/signaling"

const ICE_SERVERS: RTCConfiguration["iceServers"] = [{ urls: "stun:stun.l.google.com:19302" }]

export interface PeerConnectionTransport {
  send(msg: ClientMessage): void
}

export interface PeerConnectionCallbacks {
  onRemoteStream(stream: MediaStream | null): void
  onIceConnected(): void
  onIceFailed(): void
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
        this.callbacks.onIceConnected()
      } else if (pc.iceConnectionState === "failed") {
        this.callbacks.onIceFailed()
      }
    }

    pc.onnegotiationneeded = async () => {
      if (this.role === "callee") return
      try {
        this._makingOffer = true
        await pc.setLocalDescription()
        const offerDesc = pc.localDescription
        if (!offerDesc) return
        this.transport.send({ type: "offer", offer: offerDesc })
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
    const answerDesc = pc.localDescription
    if (!answerDesc) return
    this.transport.send({ type: "answer", answer: answerDesc })
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

  async rollbackAndRestartIce(): Promise<void> {
    if (!this.pc) return
    if (this.pc.signalingState !== "stable") {
      await this.pc.setLocalDescription({ type: "rollback" })
    }
    this.pc.restartIce()
  }

  close(): void {
    this.pc?.close()
  }
}
