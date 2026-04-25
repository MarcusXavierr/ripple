import { isRemoteInputMessage, type ExtensionAck } from "@shared/remoteInputProtocol"
import { isControllableTabUrl } from "../selectedTab/isControllableTab"
import type { SelectedTab } from "../selectedTab/selectedTabStore"

type ContentResult =
  | { ok: true; stage: string }
  | { ok: false; reason: string; stage?: string }

export type BackgroundDeps = {
  readSelectedTab: () => Promise<SelectedTab | null>
  getTab: (tabId: number) => Promise<{ id?: number; url?: string }>
  // TODO: [Refactor] Porra, pq tu usou type unknown aqui? porra, tu q criou o codigo, bota um type definido
  sendMessageToTab: (tabId: number, message: unknown) => Promise<ContentResult>
  logger: Pick<Console, "debug" | "warn">
}

export async function handleExternalMessage(message: unknown, deps: BackgroundDeps): Promise<ExtensionAck> {
  if (!isRemoteInputMessage(message)) {
    deps.logger.warn("[Ripple Extension] rejected external message", message)
    return reject("invalid remote input message", "message")
  }

  deps.logger.debug("[Ripple Extension] received remote-click", message)

  const selectedTab = await deps.readSelectedTab()
  if (!selectedTab) return reject("no selected tab", "selected-tab")

  // TODO: [Refactor] SEM catch sem log meu barão. Eu tenho duas bolas e nenhuma delas é de cristal.
  const tab = await deps.getTab(selectedTab.tabId).catch(() => null)
  // TODO: [Refactor] Sem if one liners macaco
  if (!tab) return reject("selected tab no longer exists", "selected-tab")
  if (!isControllableTabUrl(tab.url)) return reject("selected tab URL is not controllable", "selected-tab")

  const result = await deps.sendMessageToTab(selectedTab.tabId, {
    type: "execute-remote-click",
    click: message.click,
  })

  if (!result.ok) return reject(result.reason, result.stage)

  deps.logger.debug("[Ripple Extension] forwarded to tab", selectedTab.tabId)
  return { ok: true, type: "remote-click-applied", targetTabId: selectedTab.tabId }
}

function reject(reason: string, stage?: string): ExtensionAck {
  return { ok: false, type: "remote-click-rejected", reason, stage }
}
