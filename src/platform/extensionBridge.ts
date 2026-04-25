import {
  isExtensionAck,
  type ExtensionAck,
  type PeerVideoClick,
  type RemoteInputMessage,
} from "@shared/remoteInputProtocol"

type RuntimeLike = {
  lastError?: { message?: string }
  sendMessage: (extensionId: string, message: RemoteInputMessage, callback: (response: unknown) => void) => void
}

type ExtensionBridgeDeps = {
  extensionId: string
  runtime: RuntimeLike | undefined
  logger: Pick<Console, "debug">
}

export function createExtensionBridge({ extensionId, runtime, logger }: ExtensionBridgeDeps) {
  return {
    sendRemoteClick(click: PeerVideoClick): Promise<ExtensionAck | null> {
      if (!extensionId) {
        logger.debug("[Ripple Extension] unavailable", "missing extension id")
        return Promise.resolve(null)
      }

      if (!runtime?.sendMessage) {
        logger.debug("[Ripple Extension] unavailable", "chrome.runtime.sendMessage unavailable")
        return Promise.resolve(null)
      }

      return new Promise((resolve) => {
        runtime.sendMessage(extensionId, { type: "remote-click", click }, (response) => {
          if (runtime.lastError) {
            logger.debug("[Ripple Extension] unavailable", runtime.lastError.message ?? "runtime error")
            resolve(null)
            return
          }

          if (!isExtensionAck(response)) {
            logger.debug("[Ripple Extension] unavailable", "invalid extension ack")
            resolve(null)
            return
          }

          logger.debug("[Ripple Extension] remote-click ack", response)
          resolve(response)
        })
      })
    },
  }
}

function getChromeRuntime(): RuntimeLike | undefined {
  const g = globalThis as Record<string, unknown>
  const maybeChrome = g["chrome"] as { runtime?: RuntimeLike } | undefined
  return maybeChrome?.runtime
}

export const extensionBridge = createExtensionBridge({
  extensionId: import.meta.env.VITE_RIPPLE_EXTENSION_ID ?? "",
  runtime: getChromeRuntime(),
  logger: console,
})
