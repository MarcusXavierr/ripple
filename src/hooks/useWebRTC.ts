// src/hooks/useWebRTC.ts
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCallStore } from '@/store/call'
import { CallSession } from '@/lib/call/CallSession'

export function useWebRTC(roomId: string) {
  const navigate = useNavigate()
  const sessionRef = useRef<CallSession | null>(null)

  useEffect(() => {
    const session = CallSession.acquire(roomId, navigate)
    sessionRef.current = session
    return () => { session.release() }
  }, [roomId, navigate])

  const {
    localStream,
    remoteStream,
    status,
    error,
    isScreenSharing,
    isMicMuted,
    isCameraOff,
  } = useCallStore()

  return {
    localStream,
    remoteStream,
    status,
    error,
    isScreenSharing,
    isMicMuted,
    isCameraOff,
    toggleMic: () => sessionRef.current?.toggleMic(),
    toggleCamera: () => sessionRef.current?.toggleCamera(),
    startScreenShare: () => sessionRef.current?.startScreenShare(),
    stopScreenShare: () => sessionRef.current?.stopScreenShare(),
    hangup: () => sessionRef.current?.hangup(),
    dismissError: () => sessionRef.current?.dismissError(),
  }
}
