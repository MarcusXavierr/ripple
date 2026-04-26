import { useCallback, useEffect, useRef, type MouseEvent, type RefObject } from "react"
import { createPeerVideoScrollCoalescer } from "@/lib/call/coalescePeerVideoScroll"
import { createPeerVideoClick, createPeerVideoScroll } from "@/lib/call/createPeerVideoInput"
import { createPeerKeyboardInput } from "@/lib/call/createPeerKeyboardInput"
import type { PeerKeyboardInput, PeerVideoClick, PeerVideoScroll } from "@shared/remoteInputProtocol"

const MAX_SCROLL_MESSAGES_PER_SECOND = 35

type UsePeerVideoRemoteInputArgs = {
  remoteVideoRef: RefObject<HTMLVideoElement | null>
  sendPeerVideoClick(click: PeerVideoClick): void
  sendPeerVideoScroll(scroll: PeerVideoScroll): void
  sendPeerKeyboardInput(input: PeerKeyboardInput): void
}

export function usePeerVideoRemoteInput({
  remoteVideoRef,
  sendPeerVideoClick,
  sendPeerVideoScroll,
  sendPeerKeyboardInput,
}: UsePeerVideoRemoteInputArgs) {
  const latestSendPeerVideoClickRef = useRef(sendPeerVideoClick)
  const latestSendPeerVideoScrollRef = useRef(sendPeerVideoScroll)
  const latestSendPeerKeyboardInputRef = useRef(sendPeerKeyboardInput)
  const keyboardCaptureArmedRef = useRef(false)

  latestSendPeerKeyboardInputRef.current = sendPeerKeyboardInput
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

  function armKeyboardCapture() {
    keyboardCaptureArmedRef.current = true
  }

  useEffect(() => {
    const remoteVideo = remoteVideoRef.current
    if (remoteVideo === null) return
    const attachedRemoteVideo: HTMLVideoElement = remoteVideo

    function handleWheel(event: WheelEvent) {
      event.preventDefault()
      armKeyboardCapture()
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

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (event.target === remoteVideoRef.current) return
      keyboardCaptureArmedRef.current = false
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!keyboardCaptureArmedRef.current) return
      if (isEditableAppTarget(event.target)) return

      const input = createPeerKeyboardInput(event)
      if (!input) return

      event.preventDefault()
      latestSendPeerKeyboardInputRef.current(input)
    }

    document.addEventListener("pointerdown", handlePointerDown, true)
    document.addEventListener("keydown", handleKeyDown, true)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true)
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [remoteVideoRef])

  const handleRemoteVideoClick = useCallback((event: MouseEvent<HTMLVideoElement>) => {
    armKeyboardCapture()
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

function isEditableAppTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
}
