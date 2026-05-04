import * as v from "valibot"
import type { Browser } from "wxt/browser"
import { urlToOriginPattern } from "../permissions/urlToOriginPattern"
import { getTabOrigin, isControllableTabUrl } from "./isControllableTab"

const SELECTED_TAB_KEY = "ripple.selectedTab"

const FiniteNumberSchema = v.pipe(v.number(), v.finite())

export const SelectedTabSchema = v.object({
  tabId: FiniteNumberSchema,
  windowId: FiniteNumberSchema,
  title: v.optional(v.string()),
  url: v.string(),
  origin: v.string(),
  selectedAt: FiniteNumberSchema,
  grantedPatterns: v.array(v.string()),
})

export type SelectedTab = v.InferOutput<typeof SelectedTabSchema>

export type SelectedTabStorage = {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
  remove(key: string): Promise<void>
}

const LegacySelectedTabSchema = v.object({
  tabId: FiniteNumberSchema,
  windowId: FiniteNumberSchema,
  title: v.optional(v.string()),
  url: v.string(),
  origin: v.string(),
  selectedAt: FiniteNumberSchema,
  grantedPatterns: v.optional(v.array(v.string())),
})

type TabLike = Pick<Browser.tabs.Tab, "id" | "windowId" | "title" | "url">

export function createSelectedTabFromTab(
  tab: TabLike,
  selectedAt = Date.now(),
  grantedPatterns: string[] = []
): SelectedTab | null {
  if (typeof tab.id !== "number" || typeof tab.windowId !== "number" || !tab.url) return null
  if (!isControllableTabUrl(tab.url)) return null

  return {
    tabId: tab.id,
    windowId: tab.windowId,
    title: tab.title,
    url: tab.url,
    origin: getTabOrigin(tab.url),
    selectedAt,
    grantedPatterns,
  }
}

export async function saveSelectedTab(storage: SelectedTabStorage, selectedTab: SelectedTab) {
  await storage.set({ [SELECTED_TAB_KEY]: selectedTab })
}

export async function readSelectedTab(storage: SelectedTabStorage): Promise<SelectedTab | null> {
  const result = await storage.get(SELECTED_TAB_KEY)
  const value = result[SELECTED_TAB_KEY]
  const parsed = v.safeParse(LegacySelectedTabSchema, value)
  if (!parsed.success) return null

  return {
    ...parsed.output,
    grantedPatterns: parsed.output.grantedPatterns ?? fallbackPatterns(parsed.output.url),
  }
}

export async function clearSelectedTab(storage: SelectedTabStorage) {
  await storage.remove(SELECTED_TAB_KEY)
}

function fallbackPatterns(url: string): string[] {
  const pattern = urlToOriginPattern(url)
  return pattern ? [pattern] : []
}
