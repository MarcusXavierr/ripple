import type { PeerVideoClick } from "@shared/remoteInputProtocol"
import { translateRemotePoint } from "./translateRemotePoint"

type ViewportSize = {
  width: number
  height: number
}

export function translateRemoteClick(click: PeerVideoClick, viewport: ViewportSize) {
  return translateRemotePoint(click, viewport)
}
