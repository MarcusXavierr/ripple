import { browser } from "wxt/browser"
import { handleExternalMessage } from "../src/background/handleExternalMessage"
import { readSelectedTab } from "../src/selectedTab/selectedTabStore"

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(injectIntoExistingTabs)
  browser.runtime.onStartup.addListener(injectIntoExistingTabs)

  browser.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
    handleExternalMessage(message, {
      readSelectedTab: () => readSelectedTab(browser.storage.local),
      getTab: (tabId) => browser.tabs.get(tabId),
      sendMessageToTab: (tabId, payload) => browser.tabs.sendMessage(tabId, payload),
      logger: console,
    })
      .then(sendResponse)
      .catch((err) => {
        sendResponse({
          ok: false,
          type: "remote-click-rejected" as const,
          reason: err instanceof Error ? err.message : "unexpected error",
        })
      })

    return true
  })
})

async function injectIntoExistingTabs() {
  const tabs = await browser.tabs.query({ url: ["http://*/*", "https://*/*"] })
  await Promise.allSettled(
    tabs
      .filter((tab) => tab.id != null)
      .map((tab) =>
        browser.scripting.executeScript({
          target: { tabId: tab.id!, allFrames: true },
          files: ["/content-scripts/content.js"],
        }),
      ),
  )
}
