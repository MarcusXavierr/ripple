import { useCallback, useEffect, useRef, useState } from "react"

export type SelfTileProps = { stream: MediaStream | null }

type Pos = { x: number; y: number }

function clamp(pos: Pos, w: number, h: number): Pos {
  return {
    x: Math.min(Math.max(pos.x, 0), window.innerWidth - w),
    y: Math.min(Math.max(pos.y, 0), window.innerHeight - h),
  }
}

export function SelfTile({ stream }: SelfTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const tileRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null)
  const posRef = useRef<Pos | null>(null)
  const rafRef = useRef<number | null>(null)
  const [position, setPosition] = useState<Pos | null>(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  // Keep posRef in sync with state (for resize clamp + initial paint).
  useEffect(() => {
    posRef.current = position
    const el = tileRef.current
    if (el && position) {
      el.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`
    }
  }, [position])

  // Re-clamp when viewport size changes (rotation, URL bar show/hide).
  useEffect(() => {
    function onResize() {
      const el = tileRef.current
      const pos = posRef.current
      if (!el || !pos) return
      const next = clamp(pos, el.offsetWidth, el.offsetHeight)
      if (next.x !== pos.x || next.y !== pos.y) setPosition(next)
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  // Cleanup any pending frame on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const el = event.currentTarget
    event.preventDefault()
    el.setPointerCapture(event.pointerId)
    const rect = el.getBoundingClientRect()
    dragRef.current = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    }
    // Seed posRef with current visual position so the first move doesn't jump.
    if (!posRef.current) {
      posRef.current = { x: rect.left, y: rect.top }
      // Switch from CSS-anchor positioning to transform-based.
      el.style.left = "0px"
      el.style.top = "0px"
      el.style.right = "auto"
      el.style.bottom = "auto"
      el.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`
    }
    el.dataset.dragging = "true"
  }, [])

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    const el = event.currentTarget
    const width = el.offsetWidth
    const height = el.offsetHeight
    const next = clamp(
      {
        x: event.clientX - dragRef.current.offsetX,
        y: event.clientY - dragRef.current.offsetY,
      },
      width,
      height
    )
    posRef.current = next
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        const p = posRef.current
        if (p && tileRef.current) {
          tileRef.current.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`
        }
      })
    }
  }, [])

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const el = event.currentTarget
    if (el.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId)
    }
    dragRef.current = null
    delete el.dataset.dragging
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (posRef.current) setPosition(posRef.current)
  }, [])

  const dragged = position !== null
  const anchorClasses = dragged
    ? ""
    : "right-3 bottom-[calc(env(safe-area-inset-bottom)+5rem)] sm:right-4 sm:bottom-[100px]"

  return (
    <div
      ref={tileRef}
      data-testid="self-tile"
      className={`glass absolute touch-none h-24 w-32 overflow-hidden rounded-2xl shadow-xl select-none sm:h-36 sm:w-48 cursor-grab data-[dragging=true]:cursor-grabbing ${anchorClasses}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <video
        ref={videoRef}
        muted
        autoPlay
        playsInline
        data-testid="self-tile-video"
        className="h-full w-full object-cover pointer-events-none"
      />
    </div>
  )
}
