import type { PeerVideoClick } from "@/types/peerVideoClick"

type ClickPoint = {
  clientX: number
  clientY: number
}

type ClickEnvironment = {
  innerWidth: number
  innerHeight: number
  screenWidth: number
  screenHeight: number
  devicePixelRatio: number
}

function getDefaultEnvironment(): ClickEnvironment {
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    devicePixelRatio: window.devicePixelRatio,
  }
}

export function createPeerVideoClick(
  video: Pick<
    HTMLVideoElement,
    "videoWidth" | "videoHeight" | "getBoundingClientRect"
  >,
  point: ClickPoint,
  env: ClickEnvironment = getDefaultEnvironment(),
): PeerVideoClick | null {
  if (video.videoWidth <= 0 || video.videoHeight <= 0) return null

  const rect = video.getBoundingClientRect()
  const scale = Math.min(
    rect.width / video.videoWidth,
    rect.height / video.videoHeight,
  )
  const renderedWidth = video.videoWidth * scale
  const renderedHeight = video.videoHeight * scale
  const offsetX = (rect.width - renderedWidth) / 2
  const offsetY = (rect.height - renderedHeight) / 2
  const x = point.clientX - rect.left - offsetX
  const y = point.clientY - rect.top - offsetY

  if (x < 0 || x > renderedWidth || y < 0 || y > renderedHeight) return null

  return {
    x,
    y,
    width: renderedWidth,
    height: renderedHeight,
    xRatio: x / renderedWidth,
    yRatio: y / renderedHeight,
    clickerViewportWidth: env.innerWidth,
    clickerViewportHeight: env.innerHeight,
    clickerScreenWidth: env.screenWidth,
    clickerScreenHeight: env.screenHeight,
    devicePixelRatio: env.devicePixelRatio,
  }
}
