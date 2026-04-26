import type { PeerVideoScroll } from "@shared/remoteInputProtocol"

type CoalescerOptions = {
  maxMessagesPerSecond: number
}

type PeerVideoScrollSender = (scroll: PeerVideoScroll) => void

export function createPeerVideoScrollCoalescer(
  send: PeerVideoScrollSender,
  { maxMessagesPerSecond }: CoalescerOptions
) {
  const intervalMs = Math.ceil(1000 / maxMessagesPerSecond)
  let pending: PeerVideoScroll | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  function flush() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (!pending) return
    const next = pending
    pending = null
    send(next)
  }

  function schedule() {
    if (timer) return
    timer = setTimeout(flush, intervalMs)
  }

  return {
    push(scroll: PeerVideoScroll) {
      if (pending && pending.deltaMode !== scroll.deltaMode) {
        flush()
      }

      pending = pending
        ? {
            ...scroll,
            deltaX: pending.deltaX + scroll.deltaX,
            deltaY: pending.deltaY + scroll.deltaY,
          }
        : scroll

      schedule()
    },
    dispose() {
      if (timer) clearTimeout(timer)
      timer = null
      pending = null
    },
  }
}
