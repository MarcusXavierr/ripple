import type { AnalyticsEventName } from "./events"
import { CALL_END_REASONS } from "./events"

test("event names union covers funnel + reliability events", () => {
  const names: AnalyticsEventName[] = [
    "call_started",
    "call_connected",
    "call_ended",
    "media_error",
    "screenshare_error",
    "call_reconnecting",
    "signaling_reconnect_exhausted",
  ]
  expect(names).toHaveLength(7)
})

test("CALL_END_REASONS lists every reason", () => {
  expect(CALL_END_REASONS).toEqual([
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
  ])
})
