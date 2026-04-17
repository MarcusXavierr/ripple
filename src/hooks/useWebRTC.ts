// src/hooks/useWebRTC.ts
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCallStore } from '@/store/call'
import { CallSession } from '@/lib/call/CallSession'

// TODO: [useWebRTC] Parece que essa bosta de hook é alimentado por duas coisas basicamente: 1. o CallSession, que parece ser tipo o "service" layer da ligação né. 2. O callStore, que é o estado da aplicação com zustand
export function useWebRTC(roomId: string) {
  const navigate = useNavigate()
  const sessionRef = useRef<CallSession | null>(null)

  useEffect(() => {
    const session = CallSession.acquire(roomId, navigate)
    sessionRef.current = session
    return () => { session.release() }
  }, [roomId, navigate])

  // TODO: [Store] Aqui eu só to retornando o estado da aplicação, tudo nessa porra tá vazio, eu imagino que o CallSession que vai setar a porra toda, mas veremos
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
    // TODO: [Refactor] esses 4 métodos aqui lidam só com o localStream né. Tem nada a ver com webRTC ou com websocket, certo? Pq essa porra não pode ir pra um módulo separado que cuida da localStream e coisas tipo toggleMic, escolher o mic e webcam que o usuário quer (pode ter mais de um), começar e terminar
    toggleMic: () => sessionRef.current?.toggleMic(),
    toggleCamera: () => sessionRef.current?.toggleCamera(),
    startScreenShare: () => sessionRef.current?.startScreenShare(),
    stopScreenShare: () => sessionRef.current?.stopScreenShare(),

    //TODO:  Esse é um dos poucos métodos que tocam websocket e webrtc, faz sentido estar aí, mas ele e o release não tentam fazer a mesma coisa? sendo o release uma versão bosta dele q só mexe naquele singleton sessions fuleiro
    hangup: () => sessionRef.current?.hangup(),
    // TODO: [Refactor] esse é um helper idiota q poderia estar em qualquer lugar, até aqui. não cabe na callsession
    dismissError: () => sessionRef.current?.dismissError(),
  }
}
