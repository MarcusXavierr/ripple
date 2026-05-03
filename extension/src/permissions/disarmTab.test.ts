import { describe, expect, it, vi } from "vitest"
import { disarmTab } from "./disarmTab"

const armed = {
  tabId: 42,
  windowId: 1,
  title: "Example",
  url: "https://example.com/x",
  origin: "https://example.com",
  selectedAt: 0,
}

function makeDeps(overrides: Partial<Parameters<typeof disarmTab>[1]> = {}) {
  return {
    remove: vi.fn().mockResolvedValue(true),
    clearSelectedTab: vi.fn().mockResolvedValue(undefined),
    logger: { warn: vi.fn() },
    ...overrides,
  }
}

describe("disarmTab", () => {
  it("removes permission then clears the store", async () => {
    const deps = makeDeps()

    await disarmTab(armed, deps)

    expect(deps.remove).toHaveBeenCalledWith({ origins: ["https://example.com/*"] })
    expect(deps.clearSelectedTab).toHaveBeenCalled()
  })

  it("clears the store even if permissions.remove rejects", async () => {
    const deps = makeDeps({ remove: vi.fn().mockRejectedValue(new Error("boom")) })

    await disarmTab(armed, deps)

    expect(deps.clearSelectedTab).toHaveBeenCalled()
  })
})
