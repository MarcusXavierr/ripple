export const CALL_END_REASONS = [
  "hangup",
  "navigated_away",
  "tab_closed",
  "peer_disconnected",
  "ping_timeout",
  "room_full",
  "room_not_found",
  "duplicate_session",
  "connect_failed",
  "unknown_close",
] as const

export type CallEndReason = (typeof CALL_END_REASONS)[number]

export type AnalyticsEventMap = {
  call_started: { roomId: string }
  call_connected: { roomId: string; msToConnect: number }
  call_ended: {
    reason: CallEndReason
    roomId: string
    durationMs: number
    wasConnected: boolean
  }
  media_error: { errorName: string }
  screenshare_error: { errorName: string }
  call_reconnecting: { attempt: number; delayMs: number }
  signaling_reconnect_exhausted: { attempts: number }
}

export type AnalyticsEventName = keyof AnalyticsEventMap
