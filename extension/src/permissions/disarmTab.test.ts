import { describe, expect, it, vi } from "vitest"
import { disarmTab } from "./disarmTab"

function makeDeps(overrides: Partial<Parameters<typeof disarmTab>[0]> = {}) {
  return {
    readSelectedTab: vi.fn().mockResolvedValue({
      tabId: 1,
      windowId: 2,
      url: "https://wikipedia.org/",
      origin: "https://wikipedia.org",
      selectedAt: 0,
      grantedPatterns: ["https://wikipedia.org/*", "https://*.wikipedia.org/*"],
    }),
    remove: vi.fn().mockResolvedValue(true),
    clearSelectedTab: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe("disarmTab", () => {
  it("removes stored patterns then clears the store", async () => {
    const deps = makeDeps()

    await disarmTab(deps)

    expect(deps.remove).toHaveBeenCalledWith({
      origins: ["https://wikipedia.org/*", "https://*.wikipedia.org/*"],
    })
    expect(deps.clearSelectedTab).toHaveBeenCalled()
  })

  it("clears the store even if remove rejects", async () => {
    const deps = makeDeps({ remove: vi.fn().mockRejectedValue(new Error("nope")) })

    await disarmTab(deps)

    expect(deps.clearSelectedTab).toHaveBeenCalled()
  })

  it("clears the store even if no record is stored", async () => {
    const deps = makeDeps({ readSelectedTab: vi.fn().mockResolvedValue(null) })

    await disarmTab(deps)

    expect(deps.remove).not.toHaveBeenCalled()
    expect(deps.clearSelectedTab).toHaveBeenCalled()
  })
})
