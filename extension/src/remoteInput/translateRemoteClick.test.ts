import type { PeerVideoClick } from "@shared/remoteInputProtocol"
import { translateRemoteClick } from "./translateRemoteClick"

const click: PeerVideoClick = {
  x: 320,
  y: 180,
  width: 640,
  height: 360,
  xRatio: 0.5,
  yRatio: 0.5,
  clickerViewportWidth: 1280,
  clickerViewportHeight: 720,
  clickerScreenWidth: 1920,
  clickerScreenHeight: 1080,
  devicePixelRatio: 1,
}

describe("translateRemoteClick", () => {
  it("maps normalized click ratios to viewport coordinates", () => {
    expect(translateRemoteClick(click, { width: 1000, height: 800 })).toEqual({ x: 500, y: 400 })
  })

  it("clamps ratios to viewport bounds", () => {
    expect(
      translateRemoteClick({ ...click, xRatio: 1.2, yRatio: -0.2 }, { width: 1000, height: 800 })
    ).toEqual({
      x: 999,
      y: 0,
    })
  })
})
