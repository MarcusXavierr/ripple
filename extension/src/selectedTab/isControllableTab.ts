import type { MessageKey } from "../i18n/t"

export function isControllableTabUrl(url: string | undefined): boolean {
  if (!url) return false

  try {
    const parsed = new URL(url)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

export function getIncompatibleTabReasonKey(url: string | undefined): MessageKey {
  if (!url) return "reason_tab_no_controllable_url"
  if (isControllableTabUrl(url)) return "reason_tab_not_controllable"

  if (url.startsWith("chrome://")) return "reason_tab_chrome_internal"
  if (url.startsWith("chrome-extension://")) return "reason_tab_extension_page"
  if (url.startsWith("file://")) return "reason_tab_file_unsupported"
  return "reason_tab_not_controllable"
}

export function getTabOrigin(url: string): string {
  return new URL(url).origin
}
