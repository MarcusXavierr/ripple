import { create } from 'zustand'

// TODO: [Types] Esses são todos os estados da call que de fato precisamos
export type CallStatus =
  | 'idle'
  | 'connecting'
  | 'waiting'
  | 'negotiating'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'

type CallStore = {
  peerId: string
  ws: WebSocket | null
  pc: RTCPeerConnection | null
  role: 'caller' | 'callee' | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  isScreenSharing: boolean
  isMicMuted: boolean
  isCameraOff: boolean
  status: CallStatus
  error: string | null
  reset: () => void
}

const INITIAL_STATE = {
  peerId: '',
  ws: null,
  pc: null,
  role: null,
  localStream: null,
  remoteStream: null,
  isScreenSharing: false,
  isMicMuted: false,
  isCameraOff: false,
  status: 'idle' as CallStatus,
  error: null,
}

export const useCallStore = create<CallStore>()((set) => ({
  ...INITIAL_STATE,
  reset: () => set(INITIAL_STATE),
}))
