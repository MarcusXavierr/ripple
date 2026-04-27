// src/lib/call/PeerConnection.ts

import type { ClientMessage } from "@/types/signaling"

const ICE_SERVERS: RTCConfiguration["iceServers"] = [{ urls: "stun:stun.l.google.com:19302" }]

export type DataChannelSpec = {
  label: string
  init?: RTCDataChannelInit
}

export interface PeerConnectionTransport {
  send(msg: ClientMessage): void
}

export interface PeerConnectionCallbacks {
  onRemoteStream(stream: MediaStream | null): void
  onIceConnected(): void
  onIceFailed(): void
  onChannelOpen(label: string): void
  onChannelClose(label: string): void
  onChannelMessage(label: string, data: string): void
}

export class PeerConnection {
  private pc: RTCPeerConnection | null = null
  private pendingCandidates: RTCIceCandidateInit[] = []
  private remoteDescriptionSet = false
  private _makingOffer = false
  private role: "caller" | "callee" | null = null

  private channels: Record<string, RTCDataChannel> = {}
  private generation = 0
  private readonly dataChannelSpecs: DataChannelSpec[]
  private readonly allowedChannelLabels: Set<string>

  private readonly transport: PeerConnectionTransport
  private readonly callbacks: PeerConnectionCallbacks

  constructor(
    transport: PeerConnectionTransport,
    callbacks: PeerConnectionCallbacks,
    dataChannels: DataChannelSpec[] = []
  ) {
    this.transport = transport
    this.callbacks = callbacks
    const labels = dataChannels.map((s) => s.label)
    const allowed = new Set(labels)
    if (allowed.size !== labels.length) {
      throw new Error(`PeerConnection: duplicate DataChannelSpec labels: ${labels.join(", ")}`)
    }
    this.dataChannelSpecs = dataChannels
    this.allowedChannelLabels = allowed
  }

  get raw(): RTCPeerConnection | null {
    return this.pc
  }

  setup(role: "caller" | "callee"): void {
    this.generation += 1
    const gen = this.generation
    this.channels = {}

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

    if (role === "caller") {
      for (const spec of this.dataChannelSpecs) {
        const ch = pc.createDataChannel(spec.label, spec.init)
        this.bindDataChannel(spec.label, ch, gen)
      }
    } else {
      pc.ondatachannel = (e) => {
        if (this.allowedChannelLabels.has(e.channel.label)) {
          this.bindDataChannel(e.channel.label, e.channel, gen)
        }
      }
    }
  }

  private bindDataChannel(label: string, ch: RTCDataChannel, gen: number): void {
    this.channels[label] = ch
    ch.onopen = () => {
      if (gen !== this.generation) return
      this.callbacks.onChannelOpen(label)
    }
    ch.onmessage = (e) => {
      if (gen !== this.generation) return
      this.callbacks.onChannelMessage(label, e.data as string)
    }
    const handleClose = () => {
      if (gen !== this.generation) return
      if (this.channels[label] !== ch) return
      delete this.channels[label]
      this.callbacks.onChannelClose(label)
    }
    ch.onclose = handleClose
    ch.onerror = handleClose
  }

  sendOnChannel(label: string, data: string): boolean {
    const ch = this.channels[label]
    if (!ch || ch.readyState !== "open") {
      console.debug(`[PeerConnection] channel ${label} not open, dropping`)
      return false
    }
    ch.send(data)
    return true
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
    this.channels = {}
  }
}
