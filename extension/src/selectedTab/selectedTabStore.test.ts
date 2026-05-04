import {
  clearSelectedTab,
  createSelectedTabFromTab,
  readSelectedTab,
  SelectedTabSchema,
  type SelectedTabStorage,
  saveSelectedTab,
} from "./selectedTabStore"

function createMemoryStorage(): SelectedTabStorage {
  const values = new Map<string, unknown>()
  return {
    async get(key: string) {
      return { [key]: values.get(key) }
    },
    async set(items: Record<string, unknown>) {
      for (const [key, value] of Object.entries(items)) values.set(key, value)
    },
    async remove(key: string) {
      values.delete(key)
    },
  }
}

describe("selectedTabStore", () => {
  it("creates selected tab state from a compatible tab", () => {
    const selected = createSelectedTabFromTab(
      {
        id: 7,
        windowId: 3,
        title: "YouTube",
        url: "https://www.youtube.com/watch?v=1",
      },
      12345,
      ["https://youtube.com/*", "https://*.youtube.com/*"]
    )

    expect(selected).toEqual({
      tabId: 7,
      windowId: 3,
      title: "YouTube",
      url: "https://www.youtube.com/watch?v=1",
      origin: "https://www.youtube.com",
      selectedAt: 12345,
      grantedPatterns: ["https://youtube.com/*", "https://*.youtube.com/*"],
    })
  })

  it("returns null for tabs without required fields", () => {
    expect(createSelectedTabFromTab({ windowId: 3, url: "https://example.com" }, 1)).toBeNull()
    expect(
      createSelectedTabFromTab({ id: 7, windowId: 3, url: "chrome://extensions" }, 1)
    ).toBeNull()
  })

  it("saves, reads, and clears selected tab state", async () => {
    const storage = createMemoryStorage()
    const selected = createSelectedTabFromTab(
      { id: 7, windowId: 3, title: "Example", url: "https://example.com/path" },
      12345,
      ["https://example.com/*"]
    )

    expect(selected).not.toBeNull()
    await saveSelectedTab(storage, selected!)
    await expect(readSelectedTab(storage)).resolves.toEqual(selected)

    await clearSelectedTab(storage)
    await expect(readSelectedTab(storage)).resolves.toBeNull()
  })

  it("returns null when persisted state is malformed", async () => {
    const storage = createMemoryStorage()

    await storage.set({
      "ripple.selectedTab": {
        tabId: 7,
        windowId: 3,
        url: "https://example.com/path",
        origin: "https://example.com",
        selectedAt: Number.NaN,
      },
    })

    await expect(readSelectedTab(storage)).resolves.toBeNull()
  })

  it("migrates legacy storage missing grantedPatterns", async () => {
    const storage = createMemoryStorage()

    await storage.set({
      "ripple.selectedTab": {
        tabId: 7,
        windowId: 3,
        url: "https://example.com/path",
        origin: "https://example.com",
        selectedAt: 12345,
      },
    })

    await expect(readSelectedTab(storage)).resolves.toEqual({
      tabId: 7,
      windowId: 3,
      url: "https://example.com/path",
      origin: "https://example.com",
      selectedAt: 12345,
      grantedPatterns: ["https://example.com/*"],
    })
  })

  it("returns stored grantedPatterns when present", async () => {
    const storage = createMemoryStorage()
    await saveSelectedTab(storage, {
      tabId: 1,
      windowId: 2,
      url: "https://wikipedia.org/",
      origin: "https://wikipedia.org",
      selectedAt: 0,
      grantedPatterns: ["https://wikipedia.org/*", "https://*.wikipedia.org/*"],
    })

    await expect(readSelectedTab(storage)).resolves.toEqual({
      tabId: 1,
      windowId: 2,
      url: "https://wikipedia.org/",
      origin: "https://wikipedia.org",
      selectedAt: 0,
      grantedPatterns: ["https://wikipedia.org/*", "https://*.wikipedia.org/*"],
    })
  })

  it("SelectedTabSchema does not include approvalStatus field", () => {
    const keys = Object.keys(SelectedTabSchema.entries)
    expect(keys).not.toContain("approvalStatus")
  })
})
