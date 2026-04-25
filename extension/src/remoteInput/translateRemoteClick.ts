import type { PeerVideoClick } from "@shared/remoteInputProtocol"

type ViewportSize = {
  width: number
  height: number
}

type ViewportPoint = {
  x: number
  y: number
}

export function translateRemoteClick(click: PeerVideoClick, viewport: ViewportSize): ViewportPoint {
  const xRatio = clamp(click.xRatio, 0, 1)
  const yRatio = clamp(click.yRatio, 0, 1)
  return {
    x: Math.min(Math.floor(xRatio * viewport.width), Math.max(viewport.width - 1, 0)),
    y: Math.min(Math.floor(yRatio * viewport.height), Math.max(viewport.height - 1, 0)),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
