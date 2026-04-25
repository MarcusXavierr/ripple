type ViewportPoint = {
  x: number
  y: number
}

export type ClickExecutionResult =
  | { ok: true; stage: "dispatched" }
  | { ok: false; reason: string; stage: "target" | "dispatch" }

// TODO: [Refactor] Funções exportadas poderiam ter um docbloc explicando o que elas fazem. até umas 3/4 linhas de comentario
export function executeRemoteClick(point: ViewportPoint, doc: Document = document): ClickExecutionResult {
  const target = doc.elementFromPoint(point.x, point.y)
  if (!target) {
    return { ok: false, reason: "click target cannot be found", stage: "target" }
  }

  try {
    // TODO: [Question] Bom, tá funcionando, mas essa sequencia tá certa?
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
      clientX: point.x,
      clientY: point.y,
      button: 0,
      buttons: type === "mousedown" ? 1 : 0,
    })
  )
}
