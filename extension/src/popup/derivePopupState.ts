import type { MessageKey } from "../i18n/t"
import {
  getIncompatibleTabReasonKey,
  getTabOrigin,
  isControllableTabUrl,
} from "../selectedTab/isControllableTab"
import type { SelectedTab } from "../selectedTab/selectedTabStore"

export type CardState =
  | { kind: "empty" }
  | { kind: "selected"; title?: string; origin: string }
  | {
      kind: "selected-is-current"
      title?: string
      origin: string
      statusKey: "popup_status_selected"
    }
  | {
      kind: "stale-closed"
      title?: string
      origin: string
      statusKey: "popup_status_tab_closed"
      staleReasonKey: "popup_reason_selected_tab_closed"
    }
  | {
      kind: "stale-incompatible"
      title?: string
      origin: string
      statusKey: "popup_status_unavailable"
      staleReasonKey: "popup_reason_selected_tab_incompatible"
    }

export type CtaState =
  | { kind: "already-selected" }
  | { kind: "use-current"; enabled: boolean; reasonKey?: MessageKey }

export type PopupState = {
  card: CardState
  cta: CtaState
  canClear: boolean
}

type CurrentTabInfo = {
  id?: number
  title?: string
  url?: string
}

type LiveLookup = { ok: true; title?: string; url: string } | { ok: false; reason: "closed" } | null

export function derivePopupState(args: {
  stored: SelectedTab | null
  currentTab: CurrentTabInfo
  liveLookup: LiveLookup
}): PopupState {
  const { stored, currentTab, liveLookup } = args
  const currentCompatible = isControllableTabUrl(currentTab.url)
  const useCurrentCta: CtaState = {
    kind: "use-current",
    enabled: currentCompatible,
    reasonKey: currentCompatible ? undefined : getIncompatibleTabReasonKey(currentTab.url),
  }

  if (!stored) {
    return { card: { kind: "empty" }, cta: useCurrentCta, canClear: false }
  }

  if (liveLookup?.ok === false) {
    return {
      card: {
        kind: "stale-closed",
        title: stored.title,
        origin: stored.origin,
        statusKey: "popup_status_tab_closed",
        staleReasonKey: "popup_reason_selected_tab_closed",
      },
      cta: useCurrentCta,
      canClear: true,
    }
  }

  const liveTitle = liveLookup?.ok ? liveLookup.title : stored.title
  const liveUrl = liveLookup?.ok ? liveLookup.url : stored.url

  if (!isControllableTabUrl(liveUrl)) {
    return {
      card: {
        kind: "stale-incompatible",
        title: liveTitle,
        origin: liveUrl,
        statusKey: "popup_status_unavailable",
        staleReasonKey: "popup_reason_selected_tab_incompatible",
      },
      cta: useCurrentCta,
      canClear: true,
    }
  }

  const liveOrigin = getTabOrigin(liveUrl)

  if (currentTab.id === stored.tabId) {
    return {
      card: {
        kind: "selected-is-current",
        title: liveTitle,
        origin: liveOrigin,
        statusKey: "popup_status_selected",
      },
      cta: { kind: "already-selected" },
      canClear: true,
    }
  }

  return {
    card: { kind: "selected", title: liveTitle, origin: liveOrigin },
    cta: useCurrentCta,
    canClear: true,
  }
}
