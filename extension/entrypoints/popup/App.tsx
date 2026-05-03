import { useCallback, useEffect, useState } from "react"
import { browser } from "wxt/browser"
import { derivePopupState, type PopupState } from "../../src/popup/derivePopupState"
import { PopupView } from "../../src/popup/PopupView"
import {
  clearSelectedTab,
  createSelectedTabFromTab,
  readSelectedTab,
  saveSelectedTab,
} from "../../src/selectedTab/selectedTabStore"
import "./App.css"

const INITIAL_STATE: PopupState = {
  card: { kind: "empty" },
  cta: { kind: "use-current", enabled: false, reasonKey: "popup_loading_current_tab" },
  canClear: false,
}

export function App() {
  const [state, setState] = useState<PopupState>(INITIAL_STATE)

  const refresh = useCallback(async () => {
    const [stored, tabs] = await Promise.all([
      readSelectedTab(browser.storage.local),
      browser.tabs.query({ active: true, currentWindow: true }),
    ])
    const currentTab = tabs[0] ?? {}
    const liveLookup = stored ? await lookupLiveTab(stored.tabId) : null

    setState(
      derivePopupState({
        stored,
        currentTab: {
          id: currentTab.id,
          title: currentTab.title,
          url: currentTab.url,
        },
        liveLookup,
      })
    )
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function useCurrentTab() {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true })
    const tab = tabs[0]
    if (!tab) return

    const selected = createSelectedTabFromTab(tab)
    if (!selected) return

    await saveSelectedTab(browser.storage.local, selected)
    await refresh()
  }

  async function onClearSelectedTab() {
    await clearSelectedTab(browser.storage.local)
    await refresh()
  }

  return (
    <PopupView
      card={state.card}
      cta={state.cta}
      canClear={state.canClear}
      onUseCurrentTab={useCurrentTab}
      onClearSelectedTab={onClearSelectedTab}
    />
  )
}

async function lookupLiveTab(tabId: number) {
  try {
    const tab = await browser.tabs.get(tabId)
    if (!tab.url) return { ok: false as const, reason: "closed" as const }
    return { ok: true as const, title: tab.title, url: tab.url }
  } catch {
    return { ok: false as const, reason: "closed" as const }
  }
}
