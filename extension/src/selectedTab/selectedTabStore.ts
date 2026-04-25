import type { Browser } from "wxt/browser"
import { getTabOrigin, isControllableTabUrl } from "./isControllableTab"

const SELECTED_TAB_KEY = "ripple.selectedTab"

export type SelectedTab = {
  tabId: number
  windowId: number
  title?: string
  url: string
  origin: string
  selectedAt: number
}

export type SelectedTabStorage = {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
  remove(key: string): Promise<void>
}

type TabLike = Pick<Browser.tabs.Tab, "id" | "windowId" | "title" | "url">

export function createSelectedTabFromTab(tab: TabLike, selectedAt = Date.now()): SelectedTab | null {
  if (typeof tab.id !== "number" || typeof tab.windowId !== "number" || !tab.url) return null
  if (!isControllableTabUrl(tab.url)) return null

  return {
    tabId: tab.id,
    windowId: tab.windowId,
    title: tab.title,
    url: tab.url,
    origin: getTabOrigin(tab.url),
    selectedAt,
  }
}

export async function saveSelectedTab(storage: SelectedTabStorage, selectedTab: SelectedTab) {
  await storage.set({ [SELECTED_TAB_KEY]: selectedTab })
}

export async function readSelectedTab(storage: SelectedTabStorage): Promise<SelectedTab | null> {
  const result = await storage.get(SELECTED_TAB_KEY)
  const value = result[SELECTED_TAB_KEY]
  if (!isSelectedTab(value)) return null
  return value
}

export async function clearSelectedTab(storage: SelectedTabStorage) {
  await storage.remove(SELECTED_TAB_KEY)
}

// TODO: [Refactor] Outro lugar bom pra usar zod
function isSelectedTab(value: unknown): value is SelectedTab {
  if (typeof value !== "object" || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.tabId === "number" &&
    typeof record.windowId === "number" &&
    (record.title === undefined || typeof record.title === "string") &&
    typeof record.url === "string" &&
    typeof record.origin === "string" &&
    typeof record.selectedAt === "number"
  )
}
