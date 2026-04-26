import type { PeerKeyboardInput } from "@shared/remoteInputProtocol"

const ALLOWED_CONTROL_KEYS = new Set(["Backspace", "Delete", "Enter"])

export function createPeerKeyboardInput(event: KeyboardEvent): PeerKeyboardInput | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null
  if (event.isComposing) return null
  if (!isAllowedKey(event.key)) return null

  return {
    key: event.key,
    code: event.code,
    location: event.location,
    repeat: event.repeat,
  }
}

function isAllowedKey(key: string): boolean {
  if (key.length === 1) return true
  return ALLOWED_CONTROL_KEYS.has(key)
}
