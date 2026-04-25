import { isRemoteInputMessage, type ExtensionAck } from "@shared/remoteInputProtocol"
import type { ContentMessage, ContentMessageResult } from "../remoteInput/contentMessages"
import { isControllableTabUrl } from "../selectedTab/isControllableTab"
import type { SelectedTab } from "../selectedTab/selectedTabStore"

export type BackgroundDeps = {
  readSelectedTab: () => Promise<SelectedTab | null>
  getTab: (tabId: number) => Promise<{ id?: number; url?: string }>
  sendMessageToTab: (tabId: number, message: ContentMessage) => Promise<ContentMessageResult>
  logger: Pick<Console, "debug" | "warn">
}

export async function handleExternalMessage(
  message: unknown,
  deps: BackgroundDeps
): Promise<ExtensionAck> {
  if (!isRemoteInputMessage(message)) {
    deps.logger.warn("[Ripple Extension] rejected external message", message)
    return reject("invalid remote input message", "message")
  }

  deps.logger.debug("[Ripple Extension] received remote-click", message)

  const selectedTab = await deps.readSelectedTab()
  if (!selectedTab) {
    return reject("no selected tab", "selected-tab")
  }

  const tab = await deps.getTab(selectedTab.tabId).catch((error) => {
    deps.logger.warn("[Ripple Extension] failed to read selected tab", {
      reason: error instanceof Error ? error.message : String(error),
      tabId: selectedTab.tabId,
    })
    return null
  })
  if (!tab) {
    return reject("selected tab no longer exists", "selected-tab")
  }
  if (!isControllableTabUrl(tab.url)) {
    return reject("selected tab URL is not controllable", "selected-tab")
  }

  const result = await deps.sendMessageToTab(selectedTab.tabId, {
    type: "execute-remote-click",
    click: message.click,
  })

  if (!result.ok) {
    return reject(result.reason, result.stage)
  }

  deps.logger.debug("[Ripple Extension] forwarded to tab", selectedTab.tabId)
  return { ok: true, type: "remote-click-applied", targetTabId: selectedTab.tabId }
}

function reject(reason: string, stage?: string): ExtensionAck {
  return { ok: false, type: "remote-click-rejected", reason, stage }
}
