import { create } from "zustand"
import type { ScreenSharePreset } from "@/lib/call/mediaProfile"

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

export type CallNotice = {
  kind: "info" | "warning"
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
  isMicMuted: boolean
  isCameraOff: boolean
  status: CallStatus
  error: string | null
  showReconnectModal: boolean
  notice: CallNotice | null
  screenSharePreset: ScreenSharePreset
  setScreenSharePreset: (preset: ScreenSharePreset) => void
  reset: () => void
}

const PRESET_STORAGE_KEY = "ripple.screenSharePreset"

function readStoredPreset(): ScreenSharePreset {
  if (typeof window === "undefined") return "auto"
  const raw = window.localStorage.getItem(PRESET_STORAGE_KEY)
  if (raw === "auto" || raw === "text" || raw === "video") return raw
  return "auto"
}

const INITIAL_STATE = {
  peerId: "",
  pc: null,
  role: null,
  localStream: null,
  remoteStream: null,
  isScreenSharing: false,
  screenShareSurface: null,
  isMicMuted: false,
  isCameraOff: false,
  status: "idle" as CallStatus,
  error: null,
  showReconnectModal: false,
  notice: null,
  screenSharePreset: readStoredPreset(),
}

export const useCallStore = create<CallStore>()((set) => ({
  ...INITIAL_STATE,
  setScreenSharePreset: (preset) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PRESET_STORAGE_KEY, preset)
    }
    set({ screenSharePreset: preset })
  },
  reset: () => set((s) => ({ ...INITIAL_STATE, screenSharePreset: s.screenSharePreset })),
}))
