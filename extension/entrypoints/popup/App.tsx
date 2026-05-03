import { useCallback, useEffect, useState } from "react"
import { browser } from "wxt/browser"
import { armTab, makeArmTabDeps } from "../../src/permissions/armTab"
import { disarmTab } from "../../src/permissions/disarmTab"
import { urlToOriginPattern } from "../../src/permissions/urlToOriginPattern"
import { derivePopupState, type LiveTab, type PopupState } from "../../src/popup/derivePopupState"
import { PopupView } from "../../src/popup/PopupView"
import {
  clearSelectedTab,
  createSelectedTabFromTab,
  readSelectedTab,
  type SelectedTab,
  saveSelectedTab,
} from "../../src/selectedTab/selectedTabStore"
import "./App.css"

const INITIAL_STATE: PopupState = { kind: "idle" }

export function App() {
  const [state, setState] = useState<PopupState>(INITIAL_STATE)

  const refresh = useCallback(async () => {
    const stored = await readSelectedTab(browser.storage.local)
    const liveTab = stored ? await lookupLiveTab(stored.tabId) : null
    const hasPermission = await lookupPermission(stored, liveTab)

    setState(
      derivePopupState({
        stored,
        liveTab,
        hasPermission,
      })
    )
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onPermissionChange = () => {
      void refresh()
    }
    const onTabUpdated = () => {
      void refresh()
    }
    const onTabRemoved = () => {
      void refresh()
    }
    const onRuntimeMessage = (message: unknown) => {
      if (isPermissionLostBroadcast(message)) {
        void refresh()
      }
    }

    browser.permissions.onAdded.addListener(onPermissionChange)
    browser.permissions.onRemoved.addListener(onPermissionChange)
    browser.tabs.onUpdated.addListener(onTabUpdated)
    browser.tabs.onRemoved.addListener(onTabRemoved)
    browser.runtime.onMessage.addListener(onRuntimeMessage)

    return () => {
      browser.permissions.onAdded.removeListener(onPermissionChange)
      browser.permissions.onRemoved.removeListener(onPermissionChange)
      browser.tabs.onUpdated.removeListener(onTabUpdated)
      browser.tabs.onRemoved.removeListener(onTabRemoved)
      browser.runtime.onMessage.removeListener(onRuntimeMessage)
    }
  }, [refresh])

  const onArm = useCallback(async () => {
    const targetTab = await getArmTarget(state)
    if (!targetTab) return

    const targetPattern = urlToOriginPattern(targetTab.url)
    const selectedTab = createSelectedTabFromTab(targetTab)
    if (!targetPattern || !selectedTab) return

    const hasPermission = await browser.permissions.contains({ origins: [targetPattern] })
    if (!hasPermission) {
      await saveSelectedTab(browser.storage.local, selectedTab)
      const granted = await browser.permissions.request({ origins: [targetPattern] })
      if (!granted) {
        await clearSelectedTab(browser.storage.local)
      }
      await refresh()
      return
    }

    await armTab(targetTab, makeArmTabDeps(browser.storage.local, console))
    await refresh()
  }, [refresh, state])

  const onDisarm = useCallback(async () => {
    if (state.kind === "idle") return

    await disarmTab({ clearSelectedTab: () => clearSelectedTab(browser.storage.local) })
    await refresh()
  }, [refresh, state])

  return <PopupView state={state} onArm={onArm} onDisarm={onDisarm} />
}

async function getArmTarget(state: PopupState) {
  if (state.kind !== "idle") {
    try {
      return await browser.tabs.get(state.armed.tabId)
    } catch {
      return null
    }
  }

  const tabs = await browser.tabs.query({ active: true, currentWindow: true })
  return tabs[0] ?? null
}

async function lookupLiveTab(tabId: number): Promise<LiveTab> {
  try {
    const tab = await browser.tabs.get(tabId)
    if (!tab.url) return { ok: false }
    return { ok: true, title: tab.title, url: tab.url }
  } catch {
    return { ok: false }
  }
}

async function lookupPermission(stored: SelectedTab | null, liveTab: LiveTab): Promise<boolean> {
  if (!stored || !liveTab || liveTab.ok === false) return false

  const pattern = urlToOriginPattern(liveTab.url)
  if (!pattern) return false

  return browser.permissions.contains({ origins: [pattern] })
}

function isPermissionLostBroadcast(
  message: unknown
): message is { type: "ripple/permission-lost" } {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "ripple/permission-lost"
  )
}
