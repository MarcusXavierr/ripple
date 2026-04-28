import type { ScreenShareSurface } from "@/store/call"

export type ScreenSharePreset = "auto" | "text" | "video"

export type ProfileName = "camera" | "screen-text" | "screen-motion"

export type Profile = {
  name: ProfileName
  captureConstraints: MediaTrackConstraints
  contentHint: "motion" | "detail"
  degradationPreference: RTCDegradationPreference
  maxBitrateBps: number
}

// getUserMedia supports min constraints; getDisplayMedia does not.
const CAMERA_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1920, min: 1280 },
  height: { ideal: 1080, min: 720 },
  frameRate: { ideal: 30, max: 30, min: 15 },
}

const SCREEN_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 30, max: 30 },
}

export function getCameraProfile(): Profile {
  return {
    name: "camera",
    captureConstraints: { ...CAMERA_CONSTRAINTS },
    contentHint: "motion",
    degradationPreference: "balanced",
    maxBitrateBps: 4_000_000,
  }
}

export function getScreenProfile(input: {
  preset: ScreenSharePreset
  displaySurface: ScreenShareSurface | "application"
}): Profile {
  const { preset, displaySurface } = input
  const wantsText = preset === "text" || (preset === "auto" && displaySurface === "browser")
  if (wantsText) {
    return {
      name: "screen-text",
      captureConstraints: { ...SCREEN_CONSTRAINTS },
      contentHint: "detail",
      degradationPreference: "maintain-resolution",
      maxBitrateBps: 2_000_000,
    }
  }
  return {
    name: "screen-motion",
    captureConstraints: { ...SCREEN_CONSTRAINTS },
    contentHint: "motion",
    degradationPreference: "balanced",
    maxBitrateBps: 5_000_000,
  }
}
