import type { SelectedTab } from "../selectedTab/selectedTabStore"
import { urlToOriginPattern } from "./urlToOriginPattern"

export type NavAction =
  | { kind: "noop" }
  | { kind: "reinject"; tabId: number }
  | { kind: "permissionLost"; tabId: number }

export async function armedTabNavigationAction(args: {
  armed: SelectedTab | null
  eventTabId: number
  changeUrl: string | undefined
  status: string | undefined
  contains: (perm: { origins: string[] }) => Promise<boolean>
}): Promise<NavAction> {
  const { armed, eventTabId, changeUrl, status, contains } = args

  if (!armed) return { kind: "noop" }
  if (armed.tabId !== eventTabId) return { kind: "noop" }
  if (!changeUrl) return { kind: "noop" }
  if (status !== "complete" && status !== "loading") return { kind: "noop" }

  const pattern = urlToOriginPattern(changeUrl)
  if (!pattern) return { kind: "permissionLost", tabId: eventTabId }

  const covered = await contains({ origins: [pattern] }).catch(() => false)
  return covered
    ? { kind: "reinject", tabId: eventTabId }
    : { kind: "permissionLost", tabId: eventTabId }
}
