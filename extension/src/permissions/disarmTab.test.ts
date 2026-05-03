import { describe, expect, it, vi } from "vitest"
import { disarmTab } from "./disarmTab"

function makeDeps(overrides: Partial<Parameters<typeof disarmTab>[0]> = {}) {
  return {
    clearSelectedTab: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe("disarmTab", () => {
  it("clears the store", async () => {
    const deps = makeDeps()

    await disarmTab(deps)

    expect(deps.clearSelectedTab).toHaveBeenCalled()
  })
})
