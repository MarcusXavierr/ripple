import { isAnalyticsEnabled, posthogClient } from "./client"
import type { AnalyticsEventMap, AnalyticsEventName } from "./events"

type TrackOptions = { beacon?: boolean }

export function track<E extends AnalyticsEventName>(
  name: E,
  props: AnalyticsEventMap[E],
  opts: TrackOptions = {}
): void {
  if (!isAnalyticsEnabled) return
  try {
    if (opts.beacon) {
      posthogClient.capture(name, props, {
        transport: "sendBeacon",
        send_instantly: true,
      })
    } else {
      posthogClient.capture(name, props)
    }
  } catch (err) {
    console.debug("[analytics] capture failed", name, err)
  }
}
