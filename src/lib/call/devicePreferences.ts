import type { BackgroundBlurLevel } from "@/store/call"

const BACKGROUND_BLUR_KEY = "ripple.backgroundBlur"

export type DeviceKind = "mic" | "cam" | "speaker"

function key(kind: DeviceKind): string {
  return `ripple.devices.${kind}`
}

export function readDevicePref(kind: DeviceKind): string | null {
  try {
    return localStorage.getItem(key(kind))
  } catch {
    return null
  }
}

export function writeDevicePref(kind: DeviceKind, id: string): void {
  try {
    localStorage.setItem(key(kind), id)
  } catch {}
}

export function readBackgroundBlurPref(): BackgroundBlurLevel {
  try {
    const level = localStorage.getItem(BACKGROUND_BLUR_KEY)
    return level === "light" || level === "strong" ? level : "off"
  } catch {
    return "off"
  }
}

export function writeBackgroundBlurPref(level: BackgroundBlurLevel): void {
  try {
    localStorage.setItem(BACKGROUND_BLUR_KEY, level)
  } catch {}
}
