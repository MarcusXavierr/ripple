import { create } from "zustand"

export type CallStatus =
  | "idle"
  | "connecting"
  | "waiting"
  | "negotiating"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "ended"

export type ScreenShareSurface = "browser" | "window" | "monitor" | null
export type RemoteMediaMode = "unknown" | "camera" | "screen"

export type CallNotice = {
  kind: "info" | "success" | "warning" | "error"
  messageKey: string
}

type CallStore = {
  peerId: string
  pc: RTCPeerConnection | null
  role: "caller" | "callee" | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  isScreenSharing: boolean
  screenShareSurface: ScreenShareSurface
  remoteMediaMode: RemoteMediaMode
  isMicMuted: boolean
  isCameraOff: boolean
  status: CallStatus
  error: string | null
  showReconnectModal: boolean
  notice: CallNotice | null
  reset: () => void
}

const INITIAL_STATE = {
  peerId: "",
  pc: null,
  role: null,
  localStream: null,
  remoteStream: null,
  isScreenSharing: false,
  screenShareSurface: null,
  remoteMediaMode: "unknown" as RemoteMediaMode,
  isMicMuted: false,
  isCameraOff: false,
  status: "idle" as CallStatus,
  error: null,
  showReconnectModal: false,
  notice: null,
}

export const useCallStore = create<CallStore>()((set) => ({
  ...INITIAL_STATE,
  reset: () => set(INITIAL_STATE),
}))
