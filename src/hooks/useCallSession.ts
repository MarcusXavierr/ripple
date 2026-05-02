import type {
  PeerKeyboardInput,
  PeerVideoClick,
  PeerVideoScroll,
} from "@shared/remoteInputProtocol"
import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CallSession } from "@/lib/call/CallSession"
import type { MediaController } from "@/lib/call/MediaController"
import { useCallStore } from "@/store/call"

export function useCallSession(roomId: string) {
  const navigate = useNavigate()
  const sessionRef = useRef<CallSession | null>(null)
  const [mediaController, setMediaController] = useState<MediaController | null>(null)

  useEffect(() => {
    const session = new CallSession(roomId, navigate)
    sessionRef.current = session
    setMediaController(session.media)
    session.start()
    return () => {
      session.teardown()
      setMediaController(null)
    }
  }, [roomId, navigate])

  const localStream = useCallStore((s) => s.localStream)
  const remoteStream = useCallStore((s) => s.remoteStream)
  const status = useCallStore((s) => s.status)
  const error = useCallStore((s) => s.error)
  const showReconnectModal = useCallStore((s) => s.showReconnectModal)
  const isMicMuted = useCallStore((s) => s.isMicMuted)
  const isCameraOff = useCallStore((s) => s.isCameraOff)
  const isScreenSharing = useCallStore((s) => s.isScreenSharing)

  const dismissError = useCallback(() => {
    const err = useCallStore.getState().error
    useCallStore.setState({ error: null })
    if (
      err?.includes("room is full") ||
      err?.includes("doesn't exist") ||
      err?.includes("another tab") ||
      err?.includes("Unable to connect")
    ) {
      navigate("/")
    }
  }, [navigate])

  const dismissReconnectModal = useCallback(() => {
    useCallStore.setState({ showReconnectModal: false })
  }, [])

  const toggleMic = useCallback(() => {
    sessionRef.current?.media.toggleMic()
  }, [])

  const toggleCamera = useCallback(() => {
    sessionRef.current?.media.toggleCamera()
  }, [])

  const startScreenShare = useCallback(() => {
    sessionRef.current?.media.startScreenShare()
  }, [])

  const stopScreenShare = useCallback(() => {
    sessionRef.current?.media.stopScreenShare()
  }, [])

  const sendPeerVideoClick = useCallback((click: PeerVideoClick) => {
    sessionRef.current?.sendPeerVideoClick(click)
  }, [])

  const sendPeerVideoScroll = useCallback((scroll: PeerVideoScroll) => {
    sessionRef.current?.sendPeerVideoScroll(scroll)
  }, [])

  const sendPeerKeyboardInput = useCallback((keyboard: PeerKeyboardInput) => {
    sessionRef.current?.sendPeerKeyboardInput(keyboard)
  }, [])

  const hangup = useCallback(() => {
    sessionRef.current?.hangup()
  }, [])

  return {
    localStream,
    remoteStream,
    status,
    error,
    showReconnectModal,
    mediaController,
    isMicMuted,
    isCameraOff,
    isScreenSharing,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    sendPeerVideoClick,
    sendPeerVideoScroll,
    sendPeerKeyboardInput,
    hangup,
    dismissError,
    dismissReconnectModal,
  }
}
