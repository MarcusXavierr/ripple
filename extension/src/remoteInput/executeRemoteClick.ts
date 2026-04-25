type ViewportPoint = {
  x: number
  y: number
}

export type ClickExecutionResult =
  | { ok: true; stage: "dispatched" }
  | { ok: false; reason: string; stage: "target" | "dispatch" }

/**
 * Dispatches the click sequence at a viewport point in the current document.
 * The extension uses this after translating a remote click into local
 * coordinates, and it reports failures as return values instead of throwing.
 */
export function executeRemoteClick(point: ViewportPoint, doc: Document = document): ClickExecutionResult {
  const target = doc.elementFromPoint(point.x, point.y)
  if (!target) {
    return { ok: false, reason: "click target cannot be found", stage: "target" }
  }

  try {
    dispatchPointerEvent(target, "pointerdown", point, doc)
    dispatchMouseEvent(target, "mousedown", point, doc)
    dispatchPointerEvent(target, "pointerup", point, doc)
    dispatchMouseEvent(target, "mouseup", point, doc)
    dispatchMouseEvent(target, "click", point, doc)
    return { ok: true, stage: "dispatched" }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "click execution failed",
      stage: "dispatch",
    }
  }
}

function dispatchPointerEvent(target: Element, type: string, point: ViewportPoint, doc: Document) {
  const EventCtor = doc.defaultView?.PointerEvent
  if (EventCtor) {
    target.dispatchEvent(
      new EventCtor(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: point.x,
        clientY: point.y,
        pointerType: "mouse",
        button: 0,
        buttons: type === "pointerdown" ? 1 : 0,
      })
    )
    return
  }

  dispatchMouseEvent(target, type, point, doc)
}

function dispatchMouseEvent(target: Element, type: string, point: ViewportPoint, doc: Document) {
  const EventCtor = doc.defaultView?.MouseEvent ?? MouseEvent
  target.dispatchEvent(
    new EventCtor(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: point.x,
      clientY: point.y,
      button: 0,
      buttons: type === "mousedown" ? 1 : 0,
    })
  )
}
