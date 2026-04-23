import { describe, expect, it } from "vitest"
import { createPeerVideoClick } from "./createPeerVideoClick"

const env = {
  innerWidth: 1280,
  innerHeight: 720,
  screenWidth: 2560,
  screenHeight: 1440,
  devicePixelRatio: 2,
}

function createVideoStub(overrides?: Partial<HTMLVideoElement>) {
  return {
    videoWidth: 400,
    videoHeight: 200,
    getBoundingClientRect: () =>
      ({
        left: 100,
        top: 50,
        width: 400,
        height: 300,
      }) as DOMRect,
    ...overrides,
  } as HTMLVideoElement
}

describe("createPeerVideoClick", () => {
  it("builds a payload relative to the visible rendered media", () => {
    const click = createPeerVideoClick(
      createVideoStub(),
      { clientX: 300, clientY: 150 },
      env,
    )

    expect(click).toEqual({
      x: 200,
      y: 50,
      width: 400,
      height: 200,
      xRatio: 0.5,
      yRatio: 0.25,
      clickerViewportWidth: 1280,
      clickerViewportHeight: 720,
      clickerScreenWidth: 2560,
      clickerScreenHeight: 1440,
      devicePixelRatio: 2,
    })
  })

  it("returns null for clicks in the letterboxed padding area", () => {
    const click = createPeerVideoClick(
      createVideoStub(),
      { clientX: 140, clientY: 80 },
      env,
    )

    expect(click).toBeNull()
  })

  it("returns null for clicks in the left and right pillarboxed padding", () => {
    const video = createVideoStub({
      videoWidth: 200,
      videoHeight: 400,
    })

    const leftPaddingClick = createPeerVideoClick(
      video,
      { clientX: 120, clientY: 200 },
      env,
    )
    const rightPaddingClick = createPeerVideoClick(
      video,
      { clientX: 480, clientY: 200 },
      env,
    )

    expect(leftPaddingClick).toBeNull()
    expect(rightPaddingClick).toBeNull()
  })

  it("accepts clicks exactly on the visible media edge", () => {
    const click = createPeerVideoClick(
      createVideoStub(),
      { clientX: 100, clientY: 100 },
      env,
    )

    expect(click).toEqual({
      x: 0,
      y: 0,
      width: 400,
      height: 200,
      xRatio: 0,
      yRatio: 0,
      clickerViewportWidth: 1280,
      clickerViewportHeight: 720,
      clickerScreenWidth: 2560,
      clickerScreenHeight: 1440,
      devicePixelRatio: 2,
    })
  })

  it("returns null when intrinsic video size is not available yet", () => {
    const click = createPeerVideoClick(
      createVideoStub({ videoWidth: 0, videoHeight: 0 }),
      { clientX: 300, clientY: 150 },
      env,
    )

    expect(click).toBeNull()
  })
})
