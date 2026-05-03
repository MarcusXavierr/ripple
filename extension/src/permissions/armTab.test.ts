import { describe, expect, it, vi } from "vitest"
import { armTab } from "./armTab"

const tab = { id: 42, windowId: 1, title: "Example", url: "https://example.com/x" }

function makeDeps(overrides: Partial<Parameters<typeof armTab>[1]> = {}) {
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
  it("requests permission, injects, then saves the selected tab", async () => {
    const deps = makeDeps()
    const result = await armTab(tab, deps)

    expect(result).toEqual({ ok: true })
    expect(deps.request).toHaveBeenCalledWith({ origins: ["https://example.com/*"] })
    expect(deps.executeScript).toHaveBeenCalledWith({
      target: { tabId: 42 },
      files: ["/content-scripts/content.js"],
    })
    expect(deps.saveSelectedTab).toHaveBeenCalled()
    expect(deps.remove).not.toHaveBeenCalled()
  })

  it("returns permission_denied when user declines, does not inject or save", async () => {
    const deps = makeDeps({ request: vi.fn().mockResolvedValue(false) })
    const result = await armTab(tab, deps)

    expect(result).toEqual({ ok: false, reason: "permission_denied" })
    expect(deps.executeScript).not.toHaveBeenCalled()
    expect(deps.saveSelectedTab).not.toHaveBeenCalled()
  })

  it("rolls back permission when executeScript fails", async () => {
    const deps = makeDeps({
      executeScript: vi.fn().mockRejectedValue(new Error("inject failed")),
    })
    const result = await armTab(tab, deps)

    expect(result).toEqual({ ok: false, reason: "injection_failed" })
    expect(deps.remove).toHaveBeenCalledWith({ origins: ["https://example.com/*"] })
    expect(deps.saveSelectedTab).not.toHaveBeenCalled()
  })

  it("rejects tabs with unsupported origins", async () => {
    const deps = makeDeps()
    const result = await armTab({ id: 42, windowId: 1, url: "chrome://extensions" }, deps)

    expect(result).toEqual({ ok: false, reason: "unsupported_origin" })
    expect(deps.request).not.toHaveBeenCalled()
  })
})
