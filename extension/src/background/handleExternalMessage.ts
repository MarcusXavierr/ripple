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

  const contentMessage: ContentMessage = toContentMessage(message)

  const result = await deps.sendMessageToTab(selectedTab.tabId, contentMessage)

  if (!result.ok) {
    return rejected(message, result.reason, result.stage)
  }

  deps.logger.debug("[Ripple Extension] forwarded to tab", selectedTab.tabId)
  return applied(message, selectedTab.tabId)
}

function toContentMessage(message: RemoteInputMessage): ContentMessage {
  if (message.type === "remote-click") {
    return { type: "execute-remote-click", click: message.click }
  }
  if (message.type === "remote-scroll") {
    return { type: "execute-remote-scroll", scroll: message.scroll }
  }
  return { type: "execute-remote-keyboard", keyboard: message.keyboard }
}

function applied(message: RemoteInputMessage, targetTabId: number): ExtensionAck {
  const typeByMessage = {
    "remote-click": "remote-click-applied",
    "remote-scroll": "remote-scroll-applied",
    "remote-keyboard": "remote-keyboard-applied",
  } as const

  return { ok: true, type: typeByMessage[message.type], targetTabId }
}

function rejected(
  message: RemoteInputMessage | null,
  reason: string,
  stage?: string
): ExtensionAck {
  const type =
    message?.type === "remote-scroll"
      ? "remote-scroll-rejected"
      : message?.type === "remote-keyboard"
        ? "remote-keyboard-rejected"
        : "remote-click-rejected"

  return { ok: false, type, reason, stage }
}
