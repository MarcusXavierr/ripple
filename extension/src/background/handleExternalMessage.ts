import {
  isRemoteInputMessage,
  type ExtensionAck,
  type RemoteInputMessage,
} from "@shared/remoteInputProtocol"
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
    return rejected(null, "invalid remote input message", "message")
  }

  deps.logger.debug("[Ripple Extension] received remote input", message)

  const selectedTab = await deps.readSelectedTab()
  if (!selectedTab) {
    return rejected(message, "no selected tab", "selected-tab")
  }

  const tab = await deps.getTab(selectedTab.tabId).catch((error) => {
    deps.logger.warn("[Ripple Extension] failed to read selected tab", {
      reason: error instanceof Error ? error.message : String(error),
      tabId: selectedTab.tabId,
    })
    return null
  })
  if (!tab) {
    return rejected(message, "selected tab no longer exists", "selected-tab")
  }
  if (!isControllableTabUrl(tab.url)) {
    return rejected(message, "selected tab URL is not controllable", "selected-tab")
  }

  const contentMessage: ContentMessage =
    message.type === "remote-click"
      ? { type: "execute-remote-click", click: message.click }
      : { type: "execute-remote-scroll", scroll: message.scroll }

  const result = await deps.sendMessageToTab(selectedTab.tabId, contentMessage)

  if (!result.ok) {
    return rejected(message, result.reason, result.stage)
  }

  deps.logger.debug("[Ripple Extension] forwarded to tab", selectedTab.tabId)
  return applied(message, selectedTab.tabId)
}

function applied(message: RemoteInputMessage, targetTabId: number): ExtensionAck {
  return {
    ok: true,
    type: message.type === "remote-click" ? "remote-click-applied" : "remote-scroll-applied",
    targetTabId,
  }
}

function rejected(
  message: RemoteInputMessage | null,
  reason: string,
  stage?: string
): ExtensionAck {
  return {
    ok: false,
    type: message?.type === "remote-scroll" ? "remote-scroll-rejected" : "remote-click-rejected",
    reason,
    stage,
  }
}
