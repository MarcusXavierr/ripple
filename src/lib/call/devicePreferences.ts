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
