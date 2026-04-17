// src/lib/call/SignalingChannel.ts
import type { ClientMessage, ReceivedMessage } from '@/types/signaling'

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

  constructor(url: string, callbacks: SignalingChannelCallbacks, maxAttempts = DEFAULT_MAX_ATTEMPTS) {
    this.url = url
    this.callbacks = callbacks
    this.maxAttempts = maxAttempts
  }

  connect(): void {
    throw new Error('not implemented')
  }

  send(_msg: ClientMessage): void {
    throw new Error('not implemented')
  }

  close(_code = 1000, _reason?: string): void {
    throw new Error('not implemented')
  }
}
