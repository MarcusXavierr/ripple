const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/

function parseHttp(url: string): URL | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
    return parsed
  } catch {
    return null
  }
}

function isIpLiteral(host: string): boolean {
  if (host.startsWith("[") && host.endsWith("]")) return true
  return IPV4_RE.test(host)
}

export function urlToGrantPatterns(url: string, includeSubdomains: boolean): string[] | null {
  const parsed = parseHttp(url)
  if (!parsed) return null

  const exactPattern = `${parsed.protocol}//${parsed.host}/*`
  if (!includeSubdomains) return [exactPattern]

  if (isIpLiteral(parsed.hostname)) return [exactPattern]

  const labels = parsed.hostname.split(".")
  if (labels.length < 2) return [exactPattern]

  const base = labels.length === 2 ? parsed.hostname : labels.slice(1).join(".")
  return [`${parsed.protocol}//${base}/*`, `${parsed.protocol}//*.${base}/*`]
}

export function canExpandSubdomains(url: string): boolean {
  const parsed = parseHttp(url)
  if (!parsed) return false
  if (isIpLiteral(parsed.hostname)) return false
  return parsed.hostname.split(".").length >= 2
}
