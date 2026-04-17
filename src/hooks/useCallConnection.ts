import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CallSession } from '@/lib/call/CallSession'
import { useCallStore } from '@/store/call'

export function useCallConnection(roomId: string) {
  const navigate = useNavigate()
  const sessionRef = useRef<CallSession | null>(null)

  useEffect(() => {
    const session = CallSession.acquire(roomId, navigate)
    sessionRef.current = session
    return () => { session.release() }
  }, [roomId, navigate])

  const status = useCallStore((s) => s.status)
  const error = useCallStore((s) => s.error)
  const remoteStream = useCallStore((s) => s.remoteStream)

  return {
    status,
    error,
    remoteStream,
    hangup: () => sessionRef.current?.hangup(),
    dismissError: () => sessionRef.current?.dismissError(),
  }
}
