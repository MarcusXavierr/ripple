// src/lib/call/SignalingChannel.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { installGlobalMocks, MockWebSocket, resetMocks } from "./__tests__/mocks"
import { SignalingChannel, type SignalingChannelCallbacks } from "./SignalingChannel"

installGlobalMocks()

const URL = "ws://test?room=r&peerId=p"

function createCallbacks(): SignalingChannelCallbacks & {
  messages: unknown[]
} {
  const messages: unknown[] = []
  return {
    messages,
    onMessage: vi.fn(async (msg) => {
      messages.push(msg)
    }),
    onConnecting: vi.fn(),
    onReconnecting: vi.fn(),
    onTerminalClose: vi.fn(),
    onMaxRetriesExceeded: vi.fn(),
  }
}

beforeEach(() => {
  resetMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

// ── connect() ────────────────────────────────────────────────────────────────

describe("connect()", () => {
  it("creates a WebSocket with the provided URL", () => {
    const ch = new SignalingChannel(URL, createCallbacks())
    ch.connect()
    expect(MockWebSocket.lastInstance?.url).toBe(URL)
  })

  it("calls onConnecting when WS is created", () => {
    const cb = createCallbacks()
    const ch = new SignalingChannel(URL, cb)
    ch.connect()
    expect(cb.onConnecting).toHaveBeenCalledOnce()
  })
})

// ── send() ───────────────────────────────────────────────────────────────────

describe("send()", () => {
  it("sends serialised message when WS is OPEN", () => {
    const ch = new SignalingChannel(URL, createCallbacks())
    ch.connect()
    ch.send({ type: "pong" })
    expect(MockWebSocket.lastInstance?.send).toHaveBeenCalledWith(JSON.stringify({ type: "pong" }))
  })

  it("does not send when WS readyState is not OPEN", () => {
    const ch = new SignalingChannel(URL, createCallbacks())
    ch.connect()
    MockWebSocket.lastInstance!.readyState = WebSocket.CONNECTING
    ch.send({ type: "pong" })
    expect(MockWebSocket.lastInstance?.send).not.toHaveBeenCalled()
  })

  it("does not throw when WS is null (before connect)", () => {
    const ch = new SignalingChannel(URL, createCallbacks())
    expect(() => ch.send({ type: "pong" })).not.toThrow()
  })
})

// ── ws.onmessage ─────────────────────────────────────────────────────────────

describe("message handling", () => {
  it("parses JSON and calls onMessage", async () => {
    const cb = createCallbacks()
    const ch = new SignalingChannel(URL, cb)
    ch.connect()
    MockWebSocket.lastInstance?.receive({ type: "ping" })
    await Promise.resolve()
    expect(cb.onMessage).toHaveBeenCalledWith({ type: "ping" })
  })

  it("logs error and does not call onMessage on bad JSON", async () => {
    const cb = createCallbacks()
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const ch = new SignalingChannel(URL, cb)
    ch.connect()
    MockWebSocket.lastInstance?.onmessage?.(new MessageEvent("message", { data: "not json {{" }))
    await Promise.resolve()
    expect(cb.onMessage).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

// ── ws.onopen ────────────────────────────────────────────────────────────────

describe("ws.onopen", () => {
  it("resets reconnect state (delay and attempts) on reconnect", async () => {
    vi.useFakeTimers()
    const cb = createCallbacks()
    const ch = new SignalingChannel(URL, cb, 5)
    ch.connect()
    // Trigger a reconnect cycle
    MockWebSocket.lastInstance?.simulateClose(1006)
    vi.runAllTimers()
    // New WS created — fire onopen
    MockWebSocket.lastInstance?.onopen?.(new Event("open"))
    // Trigger another close and check delay reset back to 1000
    const spy = vi.spyOn(globalThis, "setTimeout")
    MockWebSocket.lastInstance?.simulateClose(1006)
    const delays = spy.mock.calls.map((c) => c[1] as number).filter((d) => d > 0)
    expect(Math.min(...delays)).toBe(1000)
    spy.mockRestore()
    vi.useRealTimers()
  })
})

// ── ws.onclose — terminal codes ───────────────────────────────────────────────

describe("ws.onclose — terminal codes (4xxx)", () => {
  it("calls onTerminalClose with the code", () => {
    const cb = createCallbacks()
    const ch = new SignalingChannel(URL, cb)
    ch.connect()
    MockWebSocket.lastInstance?.simulateClose(4001)
    expect(cb.onTerminalClose).toHaveBeenCalledWith(4001)
  })

  it("does not schedule a reconnect for 4xxx", () => {
    vi.useFakeTimers()
    const cb = createCallbacks()
    const ch = new SignalingChannel(URL, cb)
    ch.connect()
    MockWebSocket.lastInstance?.simulateClose(4001)
    vi.runAllTimers()
    expect(MockWebSocket.instances).toHaveLength(1)
    vi.useRealTimers()
  })

  it("does not call onTerminalClose for clean close (1000)", () => {
    const cb = createCallbacks()
    const ch = new SignalingChannel(URL, cb)
    ch.connect()
    MockWebSocket.lastInstance?.simulateClose(1000)
    expect(cb.onTerminalClose).not.toHaveBeenCalled()
  })
})

// ── ws.onclose — reconnect ───────────────────────────────────────────────────

describe("ws.onclose — reconnect (non-4xxx)", () => {
  it("calls onReconnecting for transient close codes", () => {
    vi.useFakeTimers()
    const cb = createCallbacks()
    const ch = new SignalingChannel(URL, cb)
    ch.connect()
    MockWebSocket.lastInstance?.simulateClose(1006)
    expect(cb.onReconnecting).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it("calls onReconnecting with attempt and delayMs", () => {
    vi.useFakeTimers()
    const cb = createCallbacks()
    const ch = new SignalingChannel(URL, cb)
    ch.connect()
    MockWebSocket.lastInstance?.simulateClose(1006)
    expect(cb.onReconnecting).toHaveBeenCalledWith(1, 1000)
    vi.useRealTimers()
  })

  it("creates a new WebSocket after the reconnect delay", () => {
    vi.useFakeTimers()
    const cb = createCallbacks()
    const ch = new SignalingChannel(URL, cb)
    ch.connect()
    MockWebSocket.lastInstance?.simulateClose(1006)
    vi.runAllTimers()
    expect(MockWebSocket.instances).toHaveLength(2)
    vi.useRealTimers()
  })

  it("doubles the reconnect delay on successive failures", () => {
    vi.useFakeTimers()
    const spy = vi.spyOn(globalThis, "setTimeout")
    const cb = createCallbacks()
    const ch = new SignalingChannel(URL, cb, 5)
    ch.connect()

    MockWebSocket.lastInstance?.simulateClose(1006)
    const delay1 = spy.mock.calls[spy.mock.calls.length - 1]?.[1] as number
    vi.runAllTimers()

    MockWebSocket.lastInstance?.simulateClose(1006)
    const delay2 = spy.mock.calls[spy.mock.calls.length - 1]?.[1] as number

    expect(delay2).toBe(delay1 * 2)
    spy.mockRestore()
    vi.useRealTimers()
  })

  it("caps reconnect delay at 8 seconds", () => {
    vi.useFakeTimers()
    const spy = vi.spyOn(globalThis, "setTimeout")
    const cb = createCallbacks()
    const ch = new SignalingChannel(URL, cb, 10)
    ch.connect()

    for (let i = 0; i < 8; i++) {
      MockWebSocket.lastInstance?.simulateClose(1006)
      vi.runAllTimers()
    }

    const delays = spy.mock.calls.map((c) => c[1] as number).filter((d) => d > 0)
    expect(Math.max(...delays)).toBeLessThanOrEqual(8_000)
    spy.mockRestore()
    vi.useRealTimers()
  })

  it("calls onMaxRetriesExceeded after maxAttempts failures", () => {
    vi.useFakeTimers()
    const cb = createCallbacks()
    const ch = new SignalingChannel(URL, cb, 3)
    ch.connect()

    for (let i = 0; i < 3; i++) {
      MockWebSocket.lastInstance?.simulateClose(1006)
      vi.runAllTimers()
    }

    expect(cb.onMaxRetriesExceeded).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it("calls onMaxRetriesExceeded with attempts count", () => {
    vi.useFakeTimers()
    const cb = createCallbacks()
    const ch = new SignalingChannel(URL, cb, 3)
    ch.connect()

    for (let i = 0; i < 3; i++) {
      MockWebSocket.lastInstance?.simulateClose(1006)
      vi.runAllTimers()
    }

    expect(cb.onMaxRetriesExceeded).toHaveBeenCalledWith(3)
    vi.useRealTimers()
  })

  it("does not reconnect after onMaxRetriesExceeded", () => {
    vi.useFakeTimers()
    const cb = createCallbacks()
    const ch = new SignalingChannel(URL, cb, 3)
    ch.connect()

    for (let i = 0; i < 3; i++) {
      MockWebSocket.lastInstance?.simulateClose(1006)
      vi.runAllTimers()
    }

    // 1 initial + 2 reconnect attempts (3rd close triggers maxRetries, no 3rd WS)
    expect(MockWebSocket.instances).toHaveLength(3)
    vi.useRealTimers()
  })
})

// ── close() ──────────────────────────────────────────────────────────────────

describe("close()", () => {
  it("closes the WS with the provided code and reason", () => {
    const ch = new SignalingChannel(URL, createCallbacks())
    ch.connect()
    ch.close(1000, "hangup")
    expect(MockWebSocket.lastInstance?.close).toHaveBeenCalledWith(1000, "hangup")
  })

  it("defaults to code 1000", () => {
    const ch = new SignalingChannel(URL, createCallbacks())
    ch.connect()
    ch.close()
    expect(MockWebSocket.lastInstance?.close).toHaveBeenCalledWith(1000, undefined)
  })

  it("does not reconnect after close() even if the socket fires onclose", () => {
    vi.useFakeTimers()
    const ch = new SignalingChannel(URL, createCallbacks())
    ch.connect()
    ch.close(1000, "unmount")
    MockWebSocket.lastInstance?.simulateClose(1006)
    vi.runAllTimers()
    expect(MockWebSocket.instances).toHaveLength(1)
    vi.useRealTimers()
  })

  it("cancels a pending reconnect timer", () => {
    vi.useFakeTimers()
    const ch = new SignalingChannel(URL, createCallbacks())
    ch.connect()
    MockWebSocket.lastInstance?.simulateClose(1006)
    // timer is now scheduled
    ch.close()
    vi.runAllTimers()
    expect(MockWebSocket.instances).toHaveLength(1)
    vi.useRealTimers()
  })
})

// ── isAlive ──────────────────────────────────────────────────────────────────

describe("isAlive", () => {
  it("is true before close()", () => {
    const ch = new SignalingChannel(URL, createCallbacks())
    expect(ch.isAlive).toBe(true)
  })

  it("is false after close()", () => {
    const ch = new SignalingChannel(URL, createCallbacks())
    ch.connect()
    ch.close()
    expect(ch.isAlive).toBe(false)
  })
})
