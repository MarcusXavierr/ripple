type RemotePointRatio = {
  xRatio: number
  yRatio: number
}

type ViewportSize = {
  width: number
  height: number
}

export type ViewportPoint = {
  x: number
  y: number
}

export function translateRemotePoint(
  point: RemotePointRatio,
  viewport: ViewportSize
): ViewportPoint {
  const xRatio = clamp(point.xRatio, 0, 1)
  const yRatio = clamp(point.yRatio, 0, 1)
  return {
    x: Math.min(Math.floor(xRatio * viewport.width), Math.max(viewport.width - 1, 0)),
    y: Math.min(Math.floor(yRatio * viewport.height), Math.max(viewport.height - 1, 0)),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
