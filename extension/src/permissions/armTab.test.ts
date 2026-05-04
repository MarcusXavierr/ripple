import { describe, expect, it, vi } from "vitest"
import { armTab } from "./armTab"

const tab = { id: 42, windowId: 1, title: "Example", url: "https://wikipedia.org/" }

function makeDeps(overrides: Partial<Parameters<typeof armTab>[2]> = {}) {
  return {
    request: vi.fn().mockResolvedValue(true),
    remove: vi.fn().mockResolvedValue(true),
    executeScript: vi.fn().mockResolvedValue(undefined),
    saveSelectedTab: vi.fn().mockResolvedValue(undefined),
    logger: { warn: vi.fn(), debug: vi.fn() },
    ...overrides,
  }
}

describe("armTab", () => {
  it("requests exact-host pattern when includeSubdomains=false", async () => {
    const deps = makeDeps()
    const result = await armTab(tab, false, deps)

    expect(result).toEqual({ ok: true })
    expect(deps.request).toHaveBeenCalledWith({ origins: ["https://wikipedia.org/*"] })
    expect(deps.saveSelectedTab).toHaveBeenCalledWith(
      expect.objectContaining({ grantedPatterns: ["https://wikipedia.org/*"] })
    )
  })

  it("requests apex+wildcard pair when includeSubdomains=true and persists both", async () => {
    const deps = makeDeps()
    const result = await armTab(tab, true, deps)

    expect(result).toEqual({ ok: true })
    expect(deps.request).toHaveBeenCalledWith({
      origins: ["https://wikipedia.org/*", "https://*.wikipedia.org/*"],
    })
    expect(deps.saveSelectedTab).toHaveBeenCalledWith(
      expect.objectContaining({
        grantedPatterns: ["https://wikipedia.org/*", "https://*.wikipedia.org/*"],
      })
    )
  })

  it("returns permission_denied when user declines, does not inject or save", async () => {
    const deps = makeDeps({ request: vi.fn().mockResolvedValue(false) })
    const result = await armTab(tab, true, deps)

    expect(result).toEqual({ ok: false, reason: "permission_denied" })
    expect(deps.executeScript).not.toHaveBeenCalled()
    expect(deps.saveSelectedTab).not.toHaveBeenCalled()
  })

  it("rolls back permission when executeScript fails", async () => {
    const deps = makeDeps({
      executeScript: vi.fn().mockRejectedValue(new Error("inject failed")),
    })
    const result = await armTab(tab, true, deps)

    expect(result).toEqual({ ok: false, reason: "injection_failed" })
    expect(deps.remove).toHaveBeenCalledWith({
      origins: ["https://wikipedia.org/*", "https://*.wikipedia.org/*"],
    })
    expect(deps.saveSelectedTab).not.toHaveBeenCalled()
  })

  it("rejects tabs with unsupported origins", async () => {
    const deps = makeDeps()
    const result = await armTab({ id: 42, windowId: 1, url: "chrome://extensions" }, true, deps)

    expect(result).toEqual({ ok: false, reason: "unsupported_origin" })
    expect(deps.request).not.toHaveBeenCalled()
  })
})
