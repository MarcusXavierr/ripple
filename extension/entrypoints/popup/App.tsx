import { useCallback, useEffect, useState } from "react"
import { browser } from "wxt/browser"
import { armTab, makeArmTabDeps } from "../../src/permissions/armTab"
import { disarmTab } from "../../src/permissions/disarmTab"
import { canExpandSubdomains, urlToGrantPatterns } from "../../src/permissions/urlToGrantPatterns"
import { urlToOriginPattern } from "../../src/permissions/urlToOriginPattern"
import { derivePopupState, type LiveTab, type PopupState } from "../../src/popup/derivePopupState"
import { PopupView } from "../../src/popup/PopupView"
import { isControllableTabUrl } from "../../src/selectedTab/isControllableTab"
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
  const [liveActiveTabUrl, setLiveActiveTabUrl] = useState<string | undefined>(undefined)
  const [includeSubdomains, setIncludeSubdomains] = useState(true)

  const refresh = useCallback(async () => {
    const activeTab = await lookupActiveTabForPopup()
    setLiveActiveTabUrl(activeTab?.url)

    const stored = await readSelectedTab(browser.storage.local)
    const liveTab = stored ? await lookupLiveTab(stored.tabId) : null
    const hasPermission = await lookupPermission(stored, liveTab)
    const next = derivePopupState({
      stored,
      liveTab,
      hasPermission,
    })

    setState(next)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (liveActiveTabUrl === undefined) return
    setIncludeSubdomains(true)
  }, [liveActiveTabUrl])

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
    if (state.kind === "idle") {
      const targetTab = await lookupActiveTabForPopup()
      if (!targetTab?.url) return

      const effectiveInclude = canExpandSubdomains(targetTab.url) ? includeSubdomains : false
      const patterns = urlToGrantPatterns(targetTab.url, effectiveInclude)
      const selectedTab = patterns
        ? createSelectedTabFromTab(targetTab, Date.now(), patterns)
        : null
      if (!patterns || !selectedTab) return

      const hasPermission = await browser.permissions.contains({ origins: patterns })
      if (!hasPermission) {
        await saveSelectedTab(browser.storage.local, selectedTab)
        const granted = await browser.permissions.request({ origins: patterns })
        if (!granted) {
          await clearSelectedTab(browser.storage.local)
        }
        await refresh()
        return
      }

      await armTab(targetTab, effectiveInclude, makeArmTabDeps(browser.storage.local, console))
      await refresh()
      return
    }

    if (state.kind === "pendingApproval" || state.kind === "permissionLost") {
      const targetTab = await browser.tabs.get(state.armed.tabId).catch((error) => {
        console.log("[Ripple Extension] re-grant targetTab lookup failed", {
          tabId: state.armed.tabId,
          error,
        })
        return null
      })
      if (!targetTab?.url) return

      const patterns = state.armed.grantedPatterns
      const effectiveInclude = patterns.length > 1
      const hasPermission = await browser.permissions.contains({ origins: patterns })

      if (!hasPermission) {
        const granted = await browser.permissions.request({ origins: patterns })
        if (!granted) {
          await clearSelectedTab(browser.storage.local)
          await refresh()
          return
        }
      }

      await armTab(targetTab, effectiveInclude, makeArmTabDeps(browser.storage.local, console))
      await refresh()
    }
  }, [includeSubdomains, refresh, state])

  const onDisarm = useCallback(async () => {
    if (state.kind === "idle") return

    await disarmTab({
      readSelectedTab: () => readSelectedTab(browser.storage.local),
      remove: (perm) => browser.permissions.remove(perm),
      clearSelectedTab: () => clearSelectedTab(browser.storage.local),
    })
    await refresh()
  }, [refresh, state])

  const canExpand = liveActiveTabUrl ? canExpandSubdomains(liveActiveTabUrl) : false

  return (
    <PopupView
      state={state}
      onArm={onArm}
      onDisarm={onDisarm}
      canExpandSubdomains={canExpand}
      includeSubdomains={includeSubdomains}
      onIncludeSubdomainsChange={setIncludeSubdomains}
    />
  )
}

async function lookupActiveTabForPopup() {
  const windows = await browser.windows.getAll({ populate: true }).catch(() => [])
  const normalWindows = windows.filter((window) => window.type === "normal")
  const activeTabs = normalWindows
    .map((window) => window.tabs?.find((tab) => tab.active) ?? null)
    .filter((tab): tab is NonNullable<typeof tab> => tab !== null)

  const controllableTab = activeTabs.find((tab) => tab.url && isControllableTabUrl(tab.url))
  if (controllableTab) return controllableTab

  return activeTabs.find((tab) => typeof tab.url === "string") ?? null
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
