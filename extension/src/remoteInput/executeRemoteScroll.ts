import type { PeerVideoScroll } from "@shared/remoteInputProtocol"
import type { ViewportPoint } from "./translateRemotePoint"

export type ScrollExecutionResult =
  | { ok: true; stage: "scrolled" }
  | { ok: false; reason: string; stage: "target" | "dispatch" }

export function executeRemoteScroll(
  point: ViewportPoint,
  scroll: PeerVideoScroll,
  doc: Document = document
): ScrollExecutionResult {
  const target = doc.elementFromPoint(point.x, point.y)
  const docScroller = getDocumentScroller(doc, scroll)
  const scrollTarget = target
    ? (findScrollableTarget(target, scroll) ?? docScroller)
    : docScroller
  if (!scrollTarget) {
    return { ok: false, reason: "scroll target cannot be found", stage: "target" }
  }

  const { left, top } = convertWheelDeltaToPixels(scroll, scrollTarget, doc)

  try {
    const beforeTop = scrollTarget.scrollTop
    const beforeLeft = scrollTarget.scrollLeft
    scrollTarget.scrollBy({ left, top, behavior: "instant" })

    const moved = scrollTarget.scrollTop !== beforeTop || scrollTarget.scrollLeft !== beforeLeft
    if (!moved && scrollTarget !== docScroller && docScroller) {
      const docPixels = convertWheelDeltaToPixels(scroll, docScroller, doc)
      docScroller.scrollBy({ left: docPixels.left, top: docPixels.top, behavior: "instant" })
    }

    return { ok: true, stage: "scrolled" }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "scroll execution failed",
      stage: "dispatch",
    }
  }
}

function findScrollableTarget(
  start: Element,
  scroll: Pick<PeerVideoScroll, "deltaX" | "deltaY">
): HTMLElement | null {
  let current: Element | null = start
  while (current) {
    if (current instanceof HTMLElement && canScroll(current, scroll)) return current
    current = current.parentElement
  }
  return null
}

function getDocumentScroller(
  doc: Document,
  scroll: Pick<PeerVideoScroll, "deltaX" | "deltaY">
): HTMLElement | null {
  const scrollingElement = doc.scrollingElement
  if (scrollingElement instanceof HTMLElement && canScroll(scrollingElement, scroll)) {
    return scrollingElement
  }
  return null
}

function canScroll(element: HTMLElement, scroll: Pick<PeerVideoScroll, "deltaX" | "deltaY">) {
  const canScrollY =
    scroll.deltaY !== 0 &&
    element.scrollHeight > element.clientHeight &&
    canScrollInDirection(
      element.scrollTop,
      element.scrollHeight,
      element.clientHeight,
      scroll.deltaY
    )

  const canScrollX =
    scroll.deltaX !== 0 &&
    element.scrollWidth > element.clientWidth &&
    canScrollInDirection(
      element.scrollLeft,
      element.scrollWidth,
      element.clientWidth,
      scroll.deltaX
    )

  return canScrollY || canScrollX
}

function canScrollInDirection(
  position: number,
  scrollSize: number,
  clientSize: number,
  delta: number
) {
  if (delta > 0) return position + clientSize < scrollSize
  if (delta < 0) return position > 0
  return false
}

function convertWheelDeltaToPixels(
  scroll: Pick<PeerVideoScroll, "deltaX" | "deltaY" | "deltaMode">,
  target: HTMLElement,
  doc: Document
) {
  if (scroll.deltaMode === 0) return { left: scroll.deltaX, top: scroll.deltaY }
  if (scroll.deltaMode === 2) {
    return {
      left: scroll.deltaX * target.clientWidth,
      top: scroll.deltaY * target.clientHeight,
    }
  }

  const lineHeight = inferLineHeight(target, doc)
  return {
    left: scroll.deltaX * lineHeight,
    top: scroll.deltaY * lineHeight,
  }
}

function inferLineHeight(target: HTMLElement, doc: Document): number {
  const view = doc.defaultView
  const style = view?.getComputedStyle(target)
  const lineHeight = style ? Number.parseFloat(style.lineHeight) : Number.NaN
  if (Number.isFinite(lineHeight)) return lineHeight

  const fontSize = style ? Number.parseFloat(style.fontSize) : Number.NaN
  if (Number.isFinite(fontSize)) return fontSize * 1.2

  return 16
}
