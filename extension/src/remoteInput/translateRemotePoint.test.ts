import { describe, expect, it } from "vitest"
import { translateRemotePoint } from "./translateRemotePoint"

describe("translateRemotePoint", () => {
  it("translates ratios into viewport coordinates", () => {
    expect(
      translateRemotePoint({ xRatio: 0.5, yRatio: 0.25 }, { width: 1000, height: 800 })
    ).toEqual({
      x: 500,
      y: 200,
    })
  })

  it("clamps ratios to the viewport", () => {
    expect(translateRemotePoint({ xRatio: 2, yRatio: -1 }, { width: 1000, height: 800 })).toEqual({
      x: 999,
      y: 0,
    })
  })
})
