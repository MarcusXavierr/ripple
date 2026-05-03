import type { PeerKeyboardInput } from "@shared/remoteInputProtocol"

export type KeyboardExecutionResult =
  | { ok: true; stage: "applied" | "dispatched" }
  | {
      ok: false
      reason:
        | "reason_keyboard_contenteditable_out_of_scope"
        | "reason_keyboard_execution_failed"
        | "reason_keyboard_selection_unavailable"
        | "reason_keyboard_native_value_setter_unavailable"
      stage: "target" | "selection" | "dispatch"
    }

type TextTarget = HTMLInputElement | HTMLTextAreaElement

export function executeRemoteKeyboard(
  keyboard: PeerKeyboardInput,
  doc: Document = document
): KeyboardExecutionResult {
  const active = getDeepActiveElement(doc)

  try {
    if (active instanceof HTMLTextAreaElement) {
      return applyTextEdit(active, keyboard, doc)
    }
    if (active instanceof HTMLInputElement && isSupportedTextInput(active)) {
      if (keyboard.key === "Enter") return dispatchFocusedKeyboardEvent(keyboard, active, doc)
      return applyTextEdit(active, keyboard, doc)
    }
    if (active instanceof HTMLInputElement && active.type === "number") {
      return dispatchFocusedKeyboardEvent(keyboard, active, doc)
    }
    if (active instanceof HTMLElement && active.isContentEditable) {
      // TODO(remote-input-keyboard-contenteditable): Revisit this after V1 if we
      // decide simple contenteditable support is worth the Selection/Range
      // complexity and editor-specific edge cases.
      return {
        ok: false,
        reason: "reason_keyboard_contenteditable_out_of_scope",
        stage: "target",
      }
    }
    return dispatchFocusedKeyboardEvent(keyboard, active, doc)
  } catch {
    return {
      ok: false,
      reason: "reason_keyboard_execution_failed",
      stage: "dispatch",
    }
  }
}

function getDeepActiveElement(doc: Document): Element | null {
  let active: Element | null = doc.activeElement
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement
  }
  return active
}

function isSupportedTextInput(input: HTMLInputElement): boolean {
  return ["", "text", "search", "url", "tel", "email", "password"].includes(input.type)
}

function applyTextEdit(
  target: TextTarget,
  keyboard: PeerKeyboardInput,
  doc: Document
): KeyboardExecutionResult {
  const selectionStart = target.selectionStart
  const selectionEnd = target.selectionEnd
  if (selectionStart === null || selectionEnd === null) {
    return { ok: false, reason: "reason_keyboard_selection_unavailable", stage: "selection" }
  }

  const edit = computeTextEdit(target.value, selectionStart, selectionEnd, keyboard.key)
  if (!edit) return dispatchFocusedKeyboardEvent(keyboard, target, doc)

  if (!setNativeValue(target, edit.value)) {
    return {
      ok: false,
      reason: "reason_keyboard_native_value_setter_unavailable",
      stage: "dispatch",
    }
  }
  target.setSelectionRange(edit.caret, edit.caret)
  dispatchInputEvent(target, edit.inputType, edit.data, doc)
  return { ok: true, stage: "applied" }
}

function computeTextEdit(value: string, start: number, end: number, key: string) {
  if (key.length === 1 || key === "Enter") {
    const text = key === "Enter" ? "\n" : key
    return {
      value: value.slice(0, start) + text + value.slice(end),
      caret: start + text.length,
      inputType: "insertText",
      data: text,
    }
  }

  if (key === "Backspace") {
    if (start !== end) {
      return {
        value: value.slice(0, start) + value.slice(end),
        caret: start,
        inputType: "deleteContentBackward",
        data: null,
      }
    }
    if (start === 0) return null
    return {
      value: value.slice(0, start - 1) + value.slice(end),
      caret: start - 1,
      inputType: "deleteContentBackward",
      data: null,
    }
  }

  if (key === "Delete") {
    if (start !== end) {
      return {
        value: value.slice(0, start) + value.slice(end),
        caret: start,
        inputType: "deleteContentForward",
        data: null,
      }
    }
    if (start === value.length) return null
    return {
      value: value.slice(0, start) + value.slice(start + 1),
      caret: start,
      inputType: "deleteContentForward",
      data: null,
    }
  }

  return null
}

function setNativeValue(target: TextTarget, value: string): boolean {
  const prototype =
    target instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set
  if (!setter) return false
  setter.call(target, value)
  return true
}

function dispatchInputEvent(
  target: TextTarget,
  inputType: string,
  data: string | null,
  doc: Document
) {
  const EventCtor = doc.defaultView?.InputEvent ?? InputEvent
  target.dispatchEvent(
    new EventCtor("input", {
      bubbles: true,
      cancelable: true,
      composed: true,
      inputType,
      data,
    })
  )
}

function dispatchFocusedKeyboardEvent(
  keyboard: PeerKeyboardInput,
  active: Element | null,
  doc: Document
): KeyboardExecutionResult {
  const EventCtor = doc.defaultView?.KeyboardEvent ?? KeyboardEvent
  const target = active && "dispatchEvent" in active ? active : (doc.body ?? doc)
  target.dispatchEvent(
    new EventCtor("keydown", {
      key: keyboard.key,
      code: keyboard.code,
      location: keyboard.location,
      repeat: keyboard.repeat,
      bubbles: true,
      cancelable: true,
      composed: true,
    })
  )
  return { ok: true, stage: "dispatched" }
}
