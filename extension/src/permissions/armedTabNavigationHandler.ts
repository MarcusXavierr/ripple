import { getTabOrigin } from "../selectedTab/isControllableTab"
import type { SelectedTab } from "../selectedTab/selectedTabStore"

export type NavAction =
  | { kind: "noop" }
  | { kind: "reinject"; tabId: number }
  | { kind: "permissionLost"; tabId: number }

export function armedTabNavigationAction(args: {
  armed: SelectedTab | null
  eventTabId: number
  changeUrl: string | undefined
  status: string | undefined
}): NavAction {
  const { armed, eventTabId, changeUrl, status } = args

  if (!armed) return { kind: "noop" }
  if (armed.tabId !== eventTabId) return { kind: "noop" }
  if (!changeUrl) return { kind: "noop" }
  if (status !== "complete" && status !== "loading") return { kind: "noop" }

  try {
    const newOrigin = getTabOrigin(changeUrl)
    if (newOrigin === armed.origin) return { kind: "reinject", tabId: eventTabId }
    return { kind: "permissionLost", tabId: eventTabId }
  } catch {
    return { kind: "permissionLost", tabId: eventTabId }
  }
}
