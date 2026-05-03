import { describe, expect, it, vi } from "vitest"
import { createPermissionsGate } from "./permissionsGate"

describe("permissionsGate", () => {
  it("returns true when chrome.permissions.contains resolves true", async () => {
    const contains = vi.fn().mockResolvedValue(true)
    const gate = createPermissionsGate({ contains })

    await expect(gate.hasAccess("https://example.com/*")).resolves.toBe(true)
    expect(contains).toHaveBeenCalledWith({ origins: ["https://example.com/*"] })
  })

  it("returns false when contains resolves false", async () => {
    const gate = createPermissionsGate({ contains: vi.fn().mockResolvedValue(false) })

    await expect(gate.hasAccess("https://example.com/*")).resolves.toBe(false)
  })

  it("returns false and logs when contains rejects", async () => {
    const warn = vi.fn()
    const gate = createPermissionsGate({
      contains: vi.fn().mockRejectedValue(new Error("nope")),
      logger: { warn },
    })

    await expect(gate.hasAccess("https://example.com/*")).resolves.toBe(false)
    expect(warn).toHaveBeenCalled()
  })
})
