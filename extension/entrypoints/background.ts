import { browser } from "wxt/browser"
import { handleExternalMessage } from "../src/background/handleExternalMessage"
import { armedTabNavigationAction } from "../src/permissions/armedTabNavigationHandler"
import { createPermissionsGate } from "../src/permissions/permissionsGate"
import { clearSelectedTab, readSelectedTab } from "../src/selectedTab/selectedTabStore"

const permissionsGate = createPermissionsGate({
  contains: (perm) => browser.permissions.contains(perm),
  logger: console,
})

browser.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  const armed = await readSelectedTab(browser.storage.local)
  const action = armedTabNavigationAction({
    armed,
    eventTabId: tabId,
    changeUrl: changeInfo.url,
    status: changeInfo.status,
  })

  if (action.kind === "noop") return
  if (action.kind === "reinject") {
    await browser.scripting
      .executeScript({
        target: { tabId: action.tabId },
        files: ["/content-scripts/content.js"],
      })
      .catch(() => {})
    return
  }

  await browser.runtime.sendMessage({ type: "ripple/permission-lost" }).catch(() => {})
})

browser.tabs.onRemoved.addListener(async (tabId) => {
  const armed = await readSelectedTab(browser.storage.local)
  if (!armed || armed.tabId !== tabId) return

  await clearSelectedTab(browser.storage.local)
})

export default defineBackground(() => {
  browser.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
    handleExternalMessage(message, {
      readSelectedTab: () => readSelectedTab(browser.storage.local),
      getTab: (tabId) => browser.tabs.get(tabId),
      hasAccess: (pattern) => permissionsGate.hasAccess(pattern),
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
