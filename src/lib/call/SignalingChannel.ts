// src/lib/call/SignalingChannel.ts
import type { ClientMessage, ReceivedMessage } from "@/types/signaling"

export interface SignalingChannelCallbacks {
  onMessage(msg: ReceivedMessage): Promise<void>
  onConnecting(): void
  onReconnecting(): void
  onTerminalClose(code: number): void
  onMaxRetriesExceeded(): void
}

const DEFAULT_MAX_ATTEMPTS = 3

export class SignalingChannel {
  private ws: WebSocket | null = null
  private alive = true
  private wsAttempts = 0
  private reconnectDelay = 1000
  private reconnectTimer?: ReturnType<typeof setTimeout>

  private readonly url: string
  private readonly callbacks: SignalingChannelCallbacks
  private readonly maxAttempts: number

  constructor(
    url: string,
    callbacks: SignalingChannelCallbacks,
    maxAttempts = DEFAULT_MAX_ATTEMPTS
  ) {
    this.url = url
    this.callbacks = callbacks
    this.maxAttempts = maxAttempts
  }

  connect(): void {
    this.callbacks.onConnecting()
    const ws = new WebSocket(this.url)
    this.ws = ws

    ws.onopen = () => {
      this.reconnectDelay = 1000
      this.wsAttempts = 0
    }

    ws.onmessage = async (e: MessageEvent<string>) => {
      let msg: ReceivedMessage
      try {
        msg = JSON.parse(e.data) as ReceivedMessage
      } catch (err) {
        console.error("[WS] bad payload", e.data, err)
        return
      }
      await this.callbacks.onMessage(msg)
    }

    ws.onclose = (e: CloseEvent) => {
      if (!this.alive) return
      if (e.code === 1000) return
      if (e.code >= 4000) {
        this.callbacks.onTerminalClose(e.code)
        return
      }
      this.scheduleReconnect(`close code ${e.code}`)
    }
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  close(code = 1000, reason?: string): void {
    this.alive = false
    if (this.reconnectTimer !== undefined) clearTimeout(this.reconnectTimer)
    this.ws?.close(code, reason)
  }

  get isAlive(): boolean {
    return this.alive
  }

  private scheduleReconnect(reason: string): void {
    this.wsAttempts++
    if (this.wsAttempts >= this.maxAttempts) {
      console.error("[WS] max reconnect attempts reached")
      this.callbacks.onMaxRetriesExceeded()
      return
    }
    console.warn("[WS] reconnecting", {
      attempt: this.wsAttempts,
      delay: this.reconnectDelay,
      reason,
    })
    this.callbacks.onReconnecting()
    this.reconnectTimer = setTimeout(() => {
      if (this.alive) this.connect()
    }, this.reconnectDelay)
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 8_000)
  }
}
