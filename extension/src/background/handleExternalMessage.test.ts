import type { RemoteInputMessage } from "@shared/remoteInputProtocol"
import type { SelectedTab } from "../selectedTab/selectedTabStore"
import { type BackgroundDeps, handleExternalMessage } from "./handleExternalMessage"

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

const scrollMessage: RemoteInputMessage = {
  type: "remote-scroll",
  scroll: {
    ...message.click,
    deltaX: 0,
    deltaY: 40,
    deltaMode: 0,
  },
}

function createDeps(overrides: Partial<BackgroundDeps> = {}): BackgroundDeps {
  return {
    readSelectedTab: vi.fn().mockResolvedValue(selectedTab),
    getTab: vi.fn().mockResolvedValue({ id: 7, url: "https://example.com/page" }),
    hasAccess: vi.fn().mockResolvedValue(true),
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
      reason: "reason_invalid_remote_input_message",
      stage: "message",
    })
  })

  it("rejects when no tab is selected", async () => {
    await expect(
      handleExternalMessage(
        message,
        createDeps({ readSelectedTab: vi.fn().mockResolvedValue(null) })
      )
    ).resolves.toEqual({
      ok: false,
      type: "remote-click-rejected",
      reason: "reason_no_selected_tab",
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
        reason: "reason_click_target_not_found",
        stage: "target",
      }),
    })

    await expect(handleExternalMessage(message, deps)).resolves.toEqual({
      ok: false,
      type: "remote-click-rejected",
      reason: "reason_click_target_not_found",
      stage: "target",
    })
  })

  it("logs and rejects when the selected tab can no longer be read", async () => {
    const deps = createDeps({
      getTab: vi.fn().mockRejectedValue(new Error("No tab with id: 7")),
    })

    await expect(handleExternalMessage(message, deps)).resolves.toEqual({
      ok: false,
      type: "remote-click-rejected",
      reason: "reason_selected_tab_missing",
      stage: "selected-tab",
    })

    expect(deps.logger.warn).toHaveBeenCalledWith(
      "[Ripple Extension] failed to read selected tab",
      {
        reason: "No tab with id: 7",
        tabId: 7,
      }
    )
  })

  it("drops with permission_missing when gate returns false", async () => {
    await expect(
      handleExternalMessage(message, createDeps({ hasAccess: vi.fn().mockResolvedValue(false) }))
    ).resolves.toEqual({
      ok: false,
      type: "remote-click-rejected",
      reason: "reason_permission_missing",
      stage: "permission",
    })
  })

  it("drops with origin_changed when current tab origin differs from armed origin", async () => {
    await expect(
      handleExternalMessage(
        message,
        createDeps({ getTab: vi.fn().mockResolvedValue({ id: 7, url: "https://other.test/" }) })
      )
    ).resolves.toEqual({
      ok: false,
      type: "remote-click-rejected",
      reason: "reason_origin_changed",
      stage: "permission",
    })
  })

  it("forwards normally when origin matches and gate grants access", async () => {
    const deps = createDeps()

    await expect(handleExternalMessage(message, deps)).resolves.toEqual({
      ok: true,
      type: "remote-click-applied",
      targetTabId: 7,
    })

    expect(deps.hasAccess).toHaveBeenCalledWith("https://example.com/*")
  })

  it("returns rejected when sendMessageToTab rejects", async () => {
    const deps = createDeps({
      sendMessageToTab: vi.fn().mockRejectedValue(new Error("send boom")),
    })

    await expect(handleExternalMessage(message, deps)).resolves.toEqual({
      ok: false,
      type: "remote-click-rejected",
      reason: "reason_unexpected_error",
      stage: "send",
    })

    expect(deps.logger.warn).toHaveBeenCalled()
  })

  it("forwards a remote scroll to the selected tab", async () => {
    const deps = createDeps({
      sendMessageToTab: vi.fn().mockResolvedValue({ ok: true, stage: "scrolled" }),
    })

    await expect(handleExternalMessage(scrollMessage, deps)).resolves.toEqual({
      ok: true,
      type: "remote-scroll-applied",
      targetTabId: 7,
    })

    expect(deps.sendMessageToTab).toHaveBeenCalledWith(7, {
      type: "execute-remote-scroll",
      scroll: scrollMessage.scroll,
    })
  })

  it("rejects remote scroll content-script failures with a scroll ack", async () => {
    const deps = createDeps({
      sendMessageToTab: vi.fn().mockResolvedValue({
        ok: false,
        reason: "reason_scroll_target_not_found",
        stage: "target",
      }),
    })

    await expect(handleExternalMessage(scrollMessage, deps)).resolves.toEqual({
      ok: false,
      type: "remote-scroll-rejected",
      reason: "reason_scroll_target_not_found",
      stage: "target",
    })
  })

  it("forwards remote keyboard input to the selected tab", async () => {
    const keyboardMessage: RemoteInputMessage = {
      type: "remote-keyboard",
      keyboard: {
        key: "a",
        code: "KeyA",
        location: 0,
        repeat: false,
      },
    }
    const deps = createDeps({
      sendMessageToTab: vi.fn().mockResolvedValue({ ok: true, stage: "applied" }),
    })

    await expect(handleExternalMessage(keyboardMessage, deps)).resolves.toEqual({
      ok: true,
      type: "remote-keyboard-applied",
      targetTabId: 7,
    })

    expect(deps.sendMessageToTab).toHaveBeenCalledWith(7, {
      type: "execute-remote-keyboard",
      keyboard: keyboardMessage.keyboard,
    })
  })

  it("rejects remote keyboard content-script failures with a keyboard ack", async () => {
    const keyboardMessage: RemoteInputMessage = {
      type: "remote-keyboard",
      keyboard: {
        key: "a",
        code: "KeyA",
        location: 0,
        repeat: false,
      },
    }
    const deps = createDeps({
      sendMessageToTab: vi.fn().mockResolvedValue({
        ok: false,
        reason: "reason_keyboard_selection_unavailable",
        stage: "selection",
      }),
    })

    await expect(handleExternalMessage(keyboardMessage, deps)).resolves.toEqual({
      ok: false,
      type: "remote-keyboard-rejected",
      reason: "reason_keyboard_selection_unavailable",
      stage: "selection",
    })
  })
})
