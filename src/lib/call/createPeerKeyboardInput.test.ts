import { createPeerKeyboardInput } from "./createPeerKeyboardInput"

function keyboardEvent(overrides: Partial<KeyboardEventInit> & { key: string; code?: string }) {
  return new KeyboardEvent("keydown", {
    key: overrides.key,
    code: overrides.code ?? overrides.key,
    location: overrides.location ?? 0,
    repeat: overrides.repeat ?? false,
    ctrlKey: overrides.ctrlKey ?? false,
    metaKey: overrides.metaKey ?? false,
    altKey: overrides.altKey ?? false,
    shiftKey: overrides.shiftKey ?? false,
    bubbles: true,
  })
}

describe("createPeerKeyboardInput", () => {
  it("creates payloads for printable keys and V1 control keys", () => {
    expect(createPeerKeyboardInput(keyboardEvent({ key: "a", code: "KeyA" }))).toEqual({
      key: "a",
      code: "KeyA",
      location: 0,
      repeat: false,
    })
    expect(createPeerKeyboardInput(keyboardEvent({ key: ":", code: "Semicolon" }))?.key).toBe(":")
    expect(createPeerKeyboardInput(keyboardEvent({ key: "\\", code: "Backslash" }))?.key).toBe(
      "\\"
    )
    expect(createPeerKeyboardInput(keyboardEvent({ key: " " }))?.key).toBe(" ")
    expect(createPeerKeyboardInput(keyboardEvent({ key: "Backspace" }))?.key).toBe("Backspace")
    expect(createPeerKeyboardInput(keyboardEvent({ key: "Delete" }))?.key).toBe("Delete")
    expect(createPeerKeyboardInput(keyboardEvent({ key: "Enter" }))?.key).toBe("Enter")
  })

  it("rejects shortcuts, navigation keys, function keys, and composition", () => {
    expect(createPeerKeyboardInput(keyboardEvent({ key: "a", ctrlKey: true }))).toBeNull()
    expect(createPeerKeyboardInput(keyboardEvent({ key: "a", metaKey: true }))).toBeNull()
    expect(createPeerKeyboardInput(keyboardEvent({ key: "a", altKey: true }))).toBeNull()
    expect(createPeerKeyboardInput(keyboardEvent({ key: "Tab" }))).toBeNull()
    expect(createPeerKeyboardInput(keyboardEvent({ key: "ArrowLeft" }))).toBeNull()
    expect(createPeerKeyboardInput(keyboardEvent({ key: "F1" }))).toBeNull()

    const composing = keyboardEvent({ key: "a" })
    Object.defineProperty(composing, "isComposing", { value: true })
    expect(createPeerKeyboardInput(composing)).toBeNull()
  })
})
