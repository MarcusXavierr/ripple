import { getTabOrigin } from "../selectedTab/isControllableTab"
import type { SelectedTab } from "../selectedTab/selectedTabStore"

export type LiveTab = { ok: true; url: string; title?: string } | { ok: false } | null

export type PopupState =
  | { kind: "idle" }
  | { kind: "tabClosed"; armed: SelectedTab }
  | { kind: "permissionLost"; armed: SelectedTab; currentOrigin: string }
  | { kind: "pendingApproval"; armed: SelectedTab }
  | { kind: "controllable"; armed: SelectedTab }

export function derivePopupState(args: {
  stored: SelectedTab | null
  liveTab: LiveTab
  hasPermission: boolean
}): PopupState {
  const { stored, liveTab, hasPermission } = args

  if (!stored) return { kind: "idle" }
  if (!liveTab || liveTab.ok === false) return { kind: "tabClosed", armed: stored }

  if (hasPermission) return { kind: "controllable", armed: stored }

  const currentOrigin = safeOrigin(liveTab.url)
  if (currentOrigin === stored.origin) return { kind: "pendingApproval", armed: stored }

  return { kind: "permissionLost", armed: stored, currentOrigin: currentOrigin ?? "" }
}

function safeOrigin(url: string): string | null {
  try {
    return getTabOrigin(url)
  } catch {
    return null
  }
}
