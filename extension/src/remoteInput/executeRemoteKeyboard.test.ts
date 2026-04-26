import { executeRemoteKeyboard } from "./executeRemoteKeyboard"

describe("executeRemoteKeyboard", () => {
  it("inserts printable text into a focused input with a bubbling input event", () => {
    document.body.innerHTML = `<input value="hi" />`
    const input = document.querySelector("input")!
    const inputEvents: InputEvent[] = []
    input.addEventListener("input", (event) => inputEvents.push(event as InputEvent))
    input.focus()
    input.setSelectionRange(2, 2)

    const result = executeRemoteKeyboard(
      { key: "!", code: "Digit1", location: 0, repeat: false },
      document
    )

    expect(result).toEqual({ ok: true, stage: "applied" })
    expect(input.value).toBe("hi!")
    expect(input.selectionStart).toBe(3)
    expect(inputEvents).toHaveLength(1)
    expect(inputEvents[0].inputType).toBe("insertText")
    expect(inputEvents[0].data).toBe("!")
  })

  it("replaces selected text in a textarea", () => {
    document.body.innerHTML = `<textarea>hello</textarea>`
    const textarea = document.querySelector("textarea")!
    textarea.focus()
    textarea.setSelectionRange(1, 4)

    const result = executeRemoteKeyboard(
      { key: "a", code: "KeyA", location: 0, repeat: false },
      document
    )

    expect(result).toEqual({ ok: true, stage: "applied" })
    expect(textarea.value).toBe("hao")
    expect(textarea.selectionStart).toBe(2)
  })

  it("applies Backspace and Delete with selection-aware edits", () => {
    document.body.innerHTML = `<input value="abc" />`
    const input = document.querySelector("input")!
    input.focus()
    input.setSelectionRange(2, 2)

    expect(
      executeRemoteKeyboard({ key: "Backspace", code: "Backspace", location: 0, repeat: false })
    ).toEqual({ ok: true, stage: "applied" })
    expect(input.value).toBe("ac")

    input.setSelectionRange(1, 1)
    expect(
      executeRemoteKeyboard({ key: "Delete", code: "Delete", location: 0, repeat: false })
    ).toEqual({ ok: true, stage: "applied" })
    expect(input.value).toBe("a")
  })

  it("inserts Enter as a newline in textarea", () => {
    document.body.innerHTML = `<textarea>ab</textarea>`
    const textarea = document.querySelector("textarea")!
    textarea.focus()
    textarea.setSelectionRange(1, 1)

    executeRemoteKeyboard({ key: "Enter", code: "Enter", location: 0, repeat: false }, document)

    expect(textarea.value).toBe("a\nb")
  })

  it("uses focused dispatch for non-editable focus and single-line input Enter", () => {
    document.body.innerHTML = `<button type="button">remote button</button>`
    const button = document.querySelector("button")!
    const events: KeyboardEvent[] = []
    button.addEventListener("keydown", (event) => events.push(event))
    button.focus()

    const result = executeRemoteKeyboard(
      { key: "a", code: "KeyA", location: 0, repeat: false },
      document
    )

    expect(result).toEqual({ ok: true, stage: "dispatched" })
    expect(events).toHaveLength(1)
    expect(events[0].key).toBe("a")
  })

  it("uses focused dispatch for number inputs instead of native text editing", () => {
    document.body.innerHTML = `<input type="number" value="12" />`
    const input = document.querySelector("input")!
    const events: KeyboardEvent[] = []
    input.addEventListener("keydown", (event) => events.push(event))
    input.focus()

    const result = executeRemoteKeyboard(
      { key: "4", code: "Digit4", location: 0, repeat: false },
      document
    )

    expect(result).toEqual({ ok: true, stage: "dispatched" })
    expect(events).toHaveLength(1)
    expect(events[0].key).toBe("4")
  })
})
