import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CallSession } from '@/lib/call/CallSession'
import type { MediaController } from '@/lib/call/MediaController'
import { useCallStore } from '@/store/call'

export function useLocalMedia(roomId: string) {
  const navigate = useNavigate()
  const mediaRef = useRef<MediaController | null>(null)

  useEffect(() => {
    const session = new CallSession(roomId, navigate)
    mediaRef.current = session.media
    session.start()
    return () => { session.teardown() }
  }, [roomId, navigate])

  const localStream = useCallStore((s) => s.localStream)
  const isMicMuted = useCallStore((s) => s.isMicMuted)
  const isCameraOff = useCallStore((s) => s.isCameraOff)

  return {
    localStream,
    isMicMuted,
    isCameraOff,
    toggleMic: () => mediaRef.current?.toggleMic(),
    toggleCamera: () => mediaRef.current?.toggleCamera(),
  }
}
