import type { Browser } from "wxt/browser"
import { browser } from "wxt/browser"
import {
  createSelectedTabFromTab,
  saveSelectedTab as defaultSaveSelectedTab,
  type SelectedTab,
  type SelectedTabStorage,
} from "../selectedTab/selectedTabStore"
import { urlToOriginPattern } from "./urlToOriginPattern"

const CONTENT_SCRIPT = "/content-scripts/content.js"

type TabLike = Pick<Browser.tabs.Tab, "id" | "windowId" | "title" | "url">

export type ArmTabResult =
  | { ok: true }
  | { ok: false; reason: "unsupported_origin" | "permission_denied" | "injection_failed" }

export type ArmTabDeps = {
  request: (perm: { origins: string[] }) => Promise<boolean>
  remove: (perm: { origins: string[] }) => Promise<boolean>
  executeScript: (args: unknown) => Promise<unknown>
  saveSelectedTab: (selected: SelectedTab) => Promise<void>
  logger: Pick<Console, "warn" | "debug">
}

export async function armTab(tab: TabLike, deps: ArmTabDeps): Promise<ArmTabResult> {
  const selected = createSelectedTabFromTab(tab)
  const pattern = urlToOriginPattern(tab.url)

  if (!selected || !pattern) return { ok: false, reason: "unsupported_origin" }

  const granted = await deps.request({ origins: [pattern] })
  if (!granted) return { ok: false, reason: "permission_denied" }

  try {
    await deps.executeScript({
      target: { tabId: selected.tabId },
      files: [CONTENT_SCRIPT],
    })
  } catch (error) {
    deps.logger.warn("[Ripple Extension] executeScript failed; rolling back grant", error)
    await deps.remove({ origins: [pattern] }).catch(() => {})
    return { ok: false, reason: "injection_failed" }
  }

  await deps.saveSelectedTab(selected)
  return { ok: true }
}

export function makeArmTabDeps(
  storage: SelectedTabStorage,
  logger: Pick<Console, "warn" | "debug">
): ArmTabDeps {
  return {
    request: (perm) => browser.permissions.request(perm),
    remove: (perm) => browser.permissions.remove(perm),
    executeScript: (args) => browser.scripting.executeScript(args as never),
    saveSelectedTab: (selected) => defaultSaveSelectedTab(storage, selected),
    logger,
  }
}
