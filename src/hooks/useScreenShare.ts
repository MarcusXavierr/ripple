import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CallSession } from '@/lib/call/CallSession'
import type { MediaController } from '@/lib/call/MediaController'
import { useCallStore } from '@/store/call'

export function useScreenShare(roomId: string) {
  const navigate = useNavigate()
  const mediaRef = useRef<MediaController | null>(null)

  useEffect(() => {
    const session = CallSession.acquire(roomId, navigate)
    mediaRef.current = session.media
    return () => { session.release() }
  }, [roomId, navigate])

  const isScreenSharing = useCallStore((s) => s.isScreenSharing)

  return {
    isScreenSharing,
    startScreenShare: () => mediaRef.current?.startScreenShare(),
    stopScreenShare: () => mediaRef.current?.stopScreenShare(),
  }
}
