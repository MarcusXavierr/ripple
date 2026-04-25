export type PeerVideoClick = {
  x: number
  y: number
  width: number
  height: number
  xRatio: number
  yRatio: number
  clickerViewportWidth: number
  clickerViewportHeight: number
  clickerScreenWidth: number
  clickerScreenHeight: number
  devicePixelRatio: number
}

export type RemoteClickRequest = {
  type: "remote-click"
  click: PeerVideoClick
}

export type RemoteInputMessage = RemoteClickRequest

export type ExtensionAck =
  | { ok: true; type: "remote-click-applied"; targetTabId: number }
  | { ok: false; type: "remote-click-rejected"; reason: string; stage?: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

// TODO: [Refactor] Aqui tu poderia ter usado zod haha. não inventa moda. Até porque vamos botar mais tipos de eventos no futuro
export function isPeerVideoClick(value: unknown): value is PeerVideoClick {
  if (!isRecord(value)) return false

  return (
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height) &&
    isFiniteNumber(value.xRatio) &&
    isFiniteNumber(value.yRatio) &&
    isFiniteNumber(value.clickerViewportWidth) &&
    isFiniteNumber(value.clickerViewportHeight) &&
    isFiniteNumber(value.clickerScreenWidth) &&
    isFiniteNumber(value.clickerScreenHeight) &&
    isFiniteNumber(value.devicePixelRatio)
  )
}

export function isRemoteInputMessage(value: unknown): value is RemoteInputMessage {
  if (!isRecord(value)) return false
  return value.type === "remote-click" && isPeerVideoClick(value.click)
}

export function isExtensionAck(value: unknown): value is ExtensionAck {
  if (!isRecord(value)) return false

  if (value.ok === true) {
    return value.type === "remote-click-applied" && isFiniteNumber(value.targetTabId)
  }

  if (value.ok === false) {
    return (
      value.type === "remote-click-rejected" &&
      typeof value.reason === "string" &&
      (value.stage === undefined || typeof value.stage === "string")
    )
  }

  return false
}
