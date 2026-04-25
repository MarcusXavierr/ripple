import type { RemoteInputMessage } from "@shared/remoteInputProtocol"
import { handleExternalMessage, type BackgroundDeps } from "./handleExternalMessage"
import type { SelectedTab } from "../selectedTab/selectedTabStore"

const selectedTab: SelectedTab = {
  tabId: 7,
  windowId: 3,
  title: "Example",
  url: "https://example.com/page",
  origin: "https://example.com",
  selectedAt: 12345,
}

const message: RemoteInputMessage = {
  type: "remote-click",
  click: {
    x: 10,
    y: 20,
    width: 100,
    height: 100,
    xRatio: 0.5,
    yRatio: 0.25,
    clickerViewportWidth: 1280,
    clickerViewportHeight: 720,
    clickerScreenWidth: 1920,
    clickerScreenHeight: 1080,
    devicePixelRatio: 1,
  },
}

function createDeps(overrides: Partial<BackgroundDeps> = {}): BackgroundDeps {
  return {
    readSelectedTab: vi.fn().mockResolvedValue(selectedTab),
    getTab: vi.fn().mockResolvedValue({ id: 7, url: "https://example.com/page" }),
    sendMessageToTab: vi.fn().mockResolvedValue({ ok: true, stage: "dispatched" }),
    logger: { debug: vi.fn(), warn: vi.fn() },
    ...overrides,
  }
}

describe("handleExternalMessage", () => {
  it("rejects malformed external messages", async () => {
    await expect(handleExternalMessage({ type: "bad" }, createDeps())).resolves.toEqual({
      ok: false,
      type: "remote-click-rejected",
      reason: "invalid remote input message",
      stage: "message",
    })
  })

  it("rejects when no tab is selected", async () => {
    await expect(handleExternalMessage(message, createDeps({ readSelectedTab: vi.fn().mockResolvedValue(null) }))).resolves.toEqual({
      ok: false,
      type: "remote-click-rejected",
      reason: "no selected tab",
      stage: "selected-tab",
    })
  })

  it("forwards a remote click to the selected tab", async () => {
    const deps = createDeps()

    await expect(handleExternalMessage(message, deps)).resolves.toEqual({
      ok: true,
      type: "remote-click-applied",
      targetTabId: 7,
    })

    expect(deps.sendMessageToTab).toHaveBeenCalledWith(7, {
      type: "execute-remote-click",
      click: message.click,
    })
  })

  it("rejects content-script failures", async () => {
    const deps = createDeps({
      sendMessageToTab: vi.fn().mockResolvedValue({
        ok: false,
        reason: "click target cannot be found",
        stage: "target",
      }),
    })

    await expect(handleExternalMessage(message, deps)).resolves.toEqual({
      ok: false,
      type: "remote-click-rejected",
      reason: "click target cannot be found",
      stage: "target",
    })
  })
})
