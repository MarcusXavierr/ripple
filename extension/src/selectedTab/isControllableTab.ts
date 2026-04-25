export function isControllableTabUrl(url: string | undefined): boolean {
  if (!url) return false

  try {
    const parsed = new URL(url)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

export function getIncompatibleTabReason(url: string | undefined): string {
  if (!url) return "This tab has no controllable URL."
  if (isControllableTabUrl(url)) return ""

  if (url.startsWith("chrome://")) return "Chrome internal pages cannot be controlled."
  if (url.startsWith("chrome-extension://")) return "Extension pages cannot be controlled."
  if (url.startsWith("file://")) return "Local files are not supported in V1."
  return "This tab cannot be controlled."
}

export function getTabOrigin(url: string): string {
  return new URL(url).origin
}
