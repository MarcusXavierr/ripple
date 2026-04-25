import { browser } from "wxt/browser"
import { handleExternalMessage } from "../src/background/handleExternalMessage"
import { readSelectedTab } from "../src/selectedTab/selectedTabStore"

export default defineBackground(() => {
  browser.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
    // Keep the channel open for the async reply; Chrome expects `true` right away.
    void handleExternalMessage(message, {
      readSelectedTab: () => readSelectedTab(browser.storage.local),
      getTab: (tabId) => browser.tabs.get(tabId),
      sendMessageToTab: (tabId, payload) => browser.tabs.sendMessage(tabId, payload),
      logger: console,
    }).then(sendResponse)

    return true
  })
})
