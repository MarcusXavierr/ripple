import type { PeerVideoScroll } from "@shared/remoteInputProtocol"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createPeerVideoScrollCoalescer } from "./coalescePeerVideoScroll"

const baseScroll: PeerVideoScroll = {
  x: 10,
  y: 20,
  width: 100,
  height: 100,
  xRatio: 0.1,
  yRatio: 0.2,
  clickerViewportWidth: 1280,
  clickerViewportHeight: 720,
  clickerScreenWidth: 1920,
  clickerScreenHeight: 1080,
  devicePixelRatio: 1,
  deltaX: 1,
  deltaY: 2,
  deltaMode: 0,
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("createPeerVideoScrollCoalescer", () => {
  it("coalesces deltas and flushes at most once per interval", () => {
    const send = vi.fn()
    const coalescer = createPeerVideoScrollCoalescer(send, { maxMessagesPerSecond: 35 })

    coalescer.push(baseScroll)
    coalescer.push({ ...baseScroll, x: 30, y: 40, xRatio: 0.3, yRatio: 0.4, deltaX: 3, deltaY: 4 })

    expect(send).not.toHaveBeenCalled()

    vi.advanceTimersByTime(29)

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith({
      ...baseScroll,
      x: 30,
      y: 40,
      xRatio: 0.3,
      yRatio: 0.4,
      deltaX: 4,
      deltaY: 6,
    })
  })

  it("flushes the current batch before accepting a different deltaMode", () => {
    const send = vi.fn()
    const coalescer = createPeerVideoScrollCoalescer(send, { maxMessagesPerSecond: 35 })

    coalescer.push(baseScroll)
    coalescer.push({ ...baseScroll, deltaY: 3, deltaMode: 1 })

    expect(send).toHaveBeenCalledWith(baseScroll)

    vi.advanceTimersByTime(29)

    expect(send).toHaveBeenLastCalledWith({ ...baseScroll, deltaY: 3, deltaMode: 1 })
  })

  it("clears pending work on dispose", () => {
    const send = vi.fn()
    const coalescer = createPeerVideoScrollCoalescer(send, { maxMessagesPerSecond: 35 })

    coalescer.push(baseScroll)
    coalescer.dispose()
    vi.advanceTimersByTime(29)

    expect(send).not.toHaveBeenCalled()
  })
})
