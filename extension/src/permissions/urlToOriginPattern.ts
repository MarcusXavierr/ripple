export function urlToOriginPattern(url: string | undefined): string | null {
  if (!url) return null

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
    return `${parsed.protocol}//${parsed.host}/*`
  } catch {
    return null
  }
}
