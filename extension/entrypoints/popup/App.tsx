import { useEffect, useState } from "react"
import { type Browser, browser } from "wxt/browser"
import { PopupView } from "../../src/popup/PopupView"
import {
  getIncompatibleTabReason,
  isControllableTabUrl,
} from "../../src/selectedTab/isControllableTab"
import {
  createSelectedTabFromTab,
  readSelectedTab,
  type SelectedTab,
  saveSelectedTab,
} from "../../src/selectedTab/selectedTabStore"
import "./App.css"

type CurrentTabState =
  | { compatible: true; title?: string; url: string; tab: Browser.tabs.Tab }
  | { compatible: false; title?: string; url?: string; reason: string; tab?: Browser.tabs.Tab }

export function App() {
  const [selectedTab, setSelectedTab] = useState<SelectedTab | null>(null)
  const [currentTab, setCurrentTab] = useState<CurrentTabState>({
    compatible: false,
    reason: "Loading current tab.",
  })

  useEffect(() => {
    void refresh()
  }, [])

  async function refresh() {
    const [stored, tabs] = await Promise.all([
      readSelectedTab(browser.storage.local),
      browser.tabs.query({ active: true, currentWindow: true }),
    ])
    const tab = tabs[0]
    setSelectedTab(stored)

    if (tab?.url && isControllableTabUrl(tab.url)) {
      setCurrentTab({ compatible: true, title: tab.title, url: tab.url, tab })
      return
    }

    setCurrentTab({
      compatible: false,
      title: tab?.title,
      url: tab?.url,
      reason: getIncompatibleTabReason(tab?.url),
      tab,
    })
  }

  async function useCurrentTab() {
    if (!currentTab.compatible) return
    const selected = createSelectedTabFromTab(currentTab.tab)
    if (!selected) return
    await saveSelectedTab(browser.storage.local, selected)
    setSelectedTab(selected)
  }

  return (
    <PopupView
      selectedTab={selectedTab && { title: selectedTab.title, origin: selectedTab.origin }}
      currentTab={currentTab}
      onUseCurrentTab={useCurrentTab}
    />
  )
}
