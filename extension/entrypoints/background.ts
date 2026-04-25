import { browser } from "wxt/browser"
import { handleExternalMessage } from "../src/background/handleExternalMessage"
import { readSelectedTab } from "../src/selectedTab/selectedTabStore"

export default defineBackground(() => {
  browser.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
    // TODO: [Question] o que é esse void? não deveriamos retornar o ack do handleExternalMessage?
    void handleExternalMessage(message, {
      readSelectedTab: () => readSelectedTab(browser.storage.local),
      getTab: (tabId) => browser.tabs.get(tabId),
      sendMessageToTab: (tabId, payload) => browser.tabs.sendMessage(tabId, payload),
      // TODO: [Question] No futuro eu posso socar um sentry/observability nesse logger? Ou o chrome provavelmente vai me barrar?
      logger: console,
    }).then(sendResponse)

    return true
  })
})
