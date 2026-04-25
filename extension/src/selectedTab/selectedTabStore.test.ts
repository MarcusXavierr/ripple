import {
  clearSelectedTab,
  createSelectedTabFromTab,
  readSelectedTab,
  saveSelectedTab,
  type SelectedTabStorage,
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
      12345
    )

    expect(selected).toEqual({
      tabId: 7,
      windowId: 3,
      title: "YouTube",
      url: "https://www.youtube.com/watch?v=1",
      origin: "https://www.youtube.com",
      selectedAt: 12345,
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
      12345
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
})
