import type {
  PeerVideoClick,
  PeerVideoEventLocation,
  PeerVideoScroll,
} from "@shared/remoteInputProtocol"

export type PeerVideoPoint = {
  clientX: number
  clientY: number
}

export type PeerVideoEventEnvironment = {
  innerWidth: number
  innerHeight: number
  screenWidth: number
  screenHeight: number
  devicePixelRatio: number
}

type ScrollWheelData = {
  deltaX: number
  deltaY: number
  deltaMode: 0 | 1 | 2
}

export type ClickPoint = PeerVideoPoint
export type ClickEnvironment = PeerVideoEventEnvironment
export type ScrollPoint = PeerVideoPoint & ScrollWheelData
export type ScrollEnvironment = PeerVideoEventEnvironment

function getDefaultPeerVideoEventEnvironment(): PeerVideoEventEnvironment {
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    devicePixelRatio: window.devicePixelRatio,
  }
}

function createPeerVideoEventLocation(
  video: Pick<HTMLVideoElement, "videoWidth" | "videoHeight" | "getBoundingClientRect">,
  point: PeerVideoPoint,
  env: PeerVideoEventEnvironment
): PeerVideoEventLocation | null {
  if (video.videoWidth <= 0 || video.videoHeight <= 0) return null

  const rect = video.getBoundingClientRect()
  const scale = Math.min(rect.width / video.videoWidth, rect.height / video.videoHeight)
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

export function createPeerVideoClick(
  video: Pick<HTMLVideoElement, "videoWidth" | "videoHeight" | "getBoundingClientRect">,
  point: ClickPoint,
  env: ClickEnvironment = getDefaultPeerVideoEventEnvironment()
): PeerVideoClick | null {
  return createPeerVideoEventLocation(video, point, env)
}

export function createPeerVideoScroll(
  video: Pick<HTMLVideoElement, "videoWidth" | "videoHeight" | "getBoundingClientRect">,
  point: ScrollPoint,
  env: ScrollEnvironment = getDefaultPeerVideoEventEnvironment()
): PeerVideoScroll | null {
  const location = createPeerVideoEventLocation(video, point, env)
  if (!location) return null

  return {
    ...location,
    deltaX: point.deltaX,
    deltaY: point.deltaY,
    deltaMode: point.deltaMode,
  }
}
