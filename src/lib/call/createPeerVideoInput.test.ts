import { describe, expect, it } from "vitest"
import { createPeerVideoClick, createPeerVideoScroll } from "./createPeerVideoInput"

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

describe("createPeerVideoInput", () => {
  it("builds a click payload relative to the visible rendered media", () => {
    const click = createPeerVideoClick(createVideoStub(), { clientX: 300, clientY: 150 }, env)

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

  it("builds a scroll payload with video location and wheel deltas", () => {
    const scroll = createPeerVideoScroll(
      createVideoStub(),
      {
        clientX: 300,
        clientY: 150,
        deltaX: 4,
        deltaY: 24,
        deltaMode: 0,
      },
      env
    )

    expect(scroll).toEqual({
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
      deltaX: 4,
      deltaY: 24,
      deltaMode: 0,
    })
  })

  it("returns null for points in letterboxed padding", () => {
    expect(createPeerVideoClick(createVideoStub(), { clientX: 140, clientY: 80 }, env)).toBeNull()
  })

  it("returns null for points in pillarboxed padding", () => {
    const video = createVideoStub({ videoWidth: 200, videoHeight: 400 })

    expect(createPeerVideoClick(video, { clientX: 120, clientY: 200 }, env)).toBeNull()
    expect(createPeerVideoClick(video, { clientX: 480, clientY: 200 }, env)).toBeNull()
  })

  it("accepts clicks exactly on the visible media edge", () => {
    const click = createPeerVideoClick(createVideoStub(), { clientX: 100, clientY: 100 }, env)

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

  it("returns null for wheel events in video padding", () => {
    expect(
      createPeerVideoScroll(
        createVideoStub(),
        { clientX: 140, clientY: 80, deltaX: 0, deltaY: 10, deltaMode: 0 },
        env
      )
    ).toBeNull()
  })

  it("returns null when intrinsic video size is not available yet", () => {
    expect(
      createPeerVideoClick(
        createVideoStub({ videoWidth: 0, videoHeight: 0 }),
        { clientX: 300, clientY: 150 },
        env
      )
    ).toBeNull()
  })
})
