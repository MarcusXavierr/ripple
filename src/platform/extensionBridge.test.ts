import type { PeerVideoClick } from "@shared/remoteInputProtocol"
import { createExtensionBridge } from "./extensionBridge"

const click: PeerVideoClick = {
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
}

describe("extensionBridge", () => {
  it("sends remote clicks to the configured extension id", async () => {
    const sendMessage = vi.fn((_extensionId, _message, callback) => {
      callback({ ok: true, type: "remote-click-applied", targetTabId: 7 })
    })
    const logger = { debug: vi.fn() }
    const bridge = createExtensionBridge({
      extensionId: "abc123",
      runtime: { sendMessage },
      logger,
    })

    await expect(bridge.sendRemoteClick(click)).resolves.toEqual({
      ok: true,
      type: "remote-click-applied",
      targetTabId: 7,
    })

    expect(sendMessage).toHaveBeenCalledWith("abc123", { type: "remote-click", click }, expect.any(Function))
    expect(logger.debug).toHaveBeenCalledWith("[Ripple Extension] remote-click ack", {
      ok: true,
      type: "remote-click-applied",
      targetTabId: 7,
    })
  })

  it("resolves null when extension messaging is unavailable", async () => {
    const logger = { debug: vi.fn() }
    const bridge = createExtensionBridge({ extensionId: "abc123", runtime: undefined, logger })

    await expect(bridge.sendRemoteClick(click)).resolves.toBeNull()
    expect(logger.debug).toHaveBeenCalledWith("[Ripple Extension] unavailable", "chrome.runtime.sendMessage unavailable")
  })

  it("resolves null when the extension id is missing", async () => {
    const logger = { debug: vi.fn() }
    const bridge = createExtensionBridge({ extensionId: "", runtime: { sendMessage: vi.fn() }, logger })

    await expect(bridge.sendRemoteClick(click)).resolves.toBeNull()
    expect(logger.debug).toHaveBeenCalledWith("[Ripple Extension] unavailable", "missing extension id")
  })
})
