import { describe, expect, it } from "vitest"
import { getCameraProfile, getScreenProfile } from "./mediaProfile"

describe("getCameraProfile", () => {
  it("returns motion + balanced at 4 Mbps", () => {
    const p = getCameraProfile()
    expect(p.name).toBe("camera")
    expect(p.contentHint).toBe("motion")
    expect(p.degradationPreference).toBe("balanced")
    expect(p.maxBitrateBps).toBe(4_000_000)
  })

  it("requests 1080p ideal / 720p min, 30 fps with 15 fps floor", () => {
    const c = getCameraProfile().captureConstraints
    expect(c.width).toEqual({ ideal: 1920, min: 1280 })
    expect(c.height).toEqual({ ideal: 1080, min: 720 })
    expect(c.frameRate).toEqual({ ideal: 30, max: 30, min: 15 })
  })
})

describe("getScreenProfile", () => {
  it("returns screen-text when preset is 'text', regardless of surface", () => {
    for (const surface of ["monitor", "window", "browser", "application", null] as const) {
      const p = getScreenProfile({ preset: "text", displaySurface: surface })
      expect(p.name).toBe("screen-text")
      expect(p.contentHint).toBe("detail")
      expect(p.degradationPreference).toBe("maintain-resolution")
      expect(p.maxBitrateBps).toBe(2_000_000)
    }
  })

  it("returns screen-motion when preset is 'video', regardless of surface", () => {
    for (const surface of ["monitor", "window", "browser", "application", null] as const) {
      const p = getScreenProfile({ preset: "video", displaySurface: surface })
      expect(p.name).toBe("screen-motion")
      expect(p.contentHint).toBe("motion")
      expect(p.degradationPreference).toBe("balanced")
      expect(p.maxBitrateBps).toBe(5_000_000)
    }
  })

  it("auto + browser surface picks screen-text", () => {
    const p = getScreenProfile({ preset: "auto", displaySurface: "browser" })
    expect(p.name).toBe("screen-text")
  })

  it("auto + monitor / window / application / null picks screen-motion", () => {
    for (const surface of ["monitor", "window", "application", null] as const) {
      const p = getScreenProfile({ preset: "auto", displaySurface: surface })
      expect(p.name).toBe("screen-motion")
    }
  })

  it("uses 1080p / 30fps capture constraints for all screen profiles (no min — getDisplayMedia rejects min)", () => {
    const p = getScreenProfile({ preset: "auto", displaySurface: "browser" })
    expect(p.captureConstraints.width).toEqual({ ideal: 1920 })
    expect(p.captureConstraints.height).toEqual({ ideal: 1080 })
    expect(p.captureConstraints.frameRate).toEqual({ ideal: 30, max: 30 })
  })
})
