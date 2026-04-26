import { useCallback, useEffect, useRef, type MouseEvent, type RefObject } from "react"
import { createPeerVideoScrollCoalescer } from "@/lib/call/coalescePeerVideoScroll"
import { createPeerVideoClick, createPeerVideoScroll } from "@/lib/call/createPeerVideoInput"
import type { PeerVideoClick, PeerVideoScroll } from "@shared/remoteInputProtocol"

const MAX_SCROLL_MESSAGES_PER_SECOND = 35

type UsePeerVideoRemoteInputArgs = {
  remoteVideoRef: RefObject<HTMLVideoElement | null>
  sendPeerVideoClick(click: PeerVideoClick): void
  sendPeerVideoScroll(scroll: PeerVideoScroll): void
}

export function usePeerVideoRemoteInput({
  remoteVideoRef,
  sendPeerVideoClick,
  sendPeerVideoScroll,
}: UsePeerVideoRemoteInputArgs) {
  const latestSendPeerVideoClickRef = useRef(sendPeerVideoClick)
  const latestSendPeerVideoScrollRef = useRef(sendPeerVideoScroll)
  const scrollCoalescerRef = useRef<ReturnType<typeof createPeerVideoScrollCoalescer> | null>(null)

  latestSendPeerVideoClickRef.current = sendPeerVideoClick
  latestSendPeerVideoScrollRef.current = sendPeerVideoScroll

  if (scrollCoalescerRef.current === null) {
    scrollCoalescerRef.current = createPeerVideoScrollCoalescer(
      (scroll) => {
        latestSendPeerVideoScrollRef.current(scroll)
      },
      {
        maxMessagesPerSecond: MAX_SCROLL_MESSAGES_PER_SECOND,
      }
    )
  }

  useEffect(() => {
    return () => {
      scrollCoalescerRef.current?.dispose()
      scrollCoalescerRef.current = null
    }
  }, [])

  useEffect(() => {
    const remoteVideo = remoteVideoRef.current
    if (remoteVideo === null) return
    const attachedRemoteVideo: HTMLVideoElement = remoteVideo

    function handleWheel(event: WheelEvent) {
      event.preventDefault()
      const scroll = createPeerVideoScroll(attachedRemoteVideo, {
        clientX: event.clientX,
        clientY: event.clientY,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaMode: event.deltaMode as 0 | 1 | 2,
      })
      if (!scroll) return
      scrollCoalescerRef.current?.push(scroll)
    }

    attachedRemoteVideo.addEventListener("wheel", handleWheel, { passive: false })
    return () => attachedRemoteVideo.removeEventListener("wheel", handleWheel)
  }, [remoteVideoRef])

  const handleRemoteVideoClick = useCallback((event: MouseEvent<HTMLVideoElement>) => {
    const click = createPeerVideoClick(event.currentTarget, {
      clientX: event.clientX,
      clientY: event.clientY,
    })

    if (!click) return
    latestSendPeerVideoClickRef.current(click)
  }, [])

  return {
    handleRemoteVideoClick,
  }
}
