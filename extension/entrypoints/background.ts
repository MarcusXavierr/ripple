import { browser } from "wxt/browser"
import { handleExternalMessage } from "../src/background/handleExternalMessage"
import { armedTabNavigationAction } from "../src/permissions/armedTabNavigationHandler"
import { disarmTab } from "../src/permissions/disarmTab"
import { createPermissionsGate } from "../src/permissions/permissionsGate"
import { urlToOriginPattern } from "../src/permissions/urlToOriginPattern"
import { clearSelectedTab, readSelectedTab } from "../src/selectedTab/selectedTabStore"

const permissionsGate = createPermissionsGate({
  contains: (perm) => browser.permissions.contains(perm),
  logger: console,
})

safeRegisterListener(() =>
  browser.permissions.onAdded.addListener(async (permissions) => {
    const armed = await readSelectedTab(browser.storage.local)
    if (!armed) return

    const armedPattern = urlToOriginPattern(armed.url)
    if (!armedPattern) return
    if (!permissions.origins?.includes(armedPattern)) return

    await activateSelectedTab(armed.tabId)
  })
)

safeRegisterListener(() =>
  browser.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    const armed = await readSelectedTab(browser.storage.local)
    const action = await armedTabNavigationAction({
      armed,
      eventTabId: tabId,
      changeUrl: changeInfo.url,
      status: changeInfo.status,
      contains: (perm) => browser.permissions.contains(perm),
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
)

safeRegisterListener(() =>
  browser.tabs.onRemoved.addListener(async (tabId) => {
    const armed = await readSelectedTab(browser.storage.local)
    if (!armed || armed.tabId !== tabId) return

    await disarmTab({
      readSelectedTab: () => readSelectedTab(browser.storage.local),
      remove: (perm) => browser.permissions.remove(perm),
      clearSelectedTab: () => clearSelectedTab(browser.storage.local),
    })
  })
)

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

async function activateSelectedTab(tabId: number) {
  await browser.scripting
    .executeScript({
      target: { tabId },
      files: ["/content-scripts/content.js"],
    })
    .catch(() => {})
}

function safeRegisterListener(register: () => void) {
  try {
    register()
  } catch {
    // WXT's fake browser used during build doesn't implement every event target.
  }
}
