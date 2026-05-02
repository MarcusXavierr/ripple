import { useEffect, useRef, useState } from "react"

export type SelfTileProps = { stream: MediaStream | null }

export function SelfTile({ stream }: SelfTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <div
      data-testid="self-tile"
      className={`glass absolute h-36 w-48 overflow-hidden rounded-2xl shadow-xl select-none ${
        dragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={
        position
          ? { left: `${position.x}px`, top: `${position.y}px` }
          : { bottom: "100px", right: "16px" }
      }
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        const rect = event.currentTarget.getBoundingClientRect()
        dragRef.current = {
          offsetX: event.clientX - rect.left,
          offsetY: event.clientY - rect.top,
        }
        setDragging(true)
      }}
      onPointerMove={(event) => {
        if (!dragRef.current) return
        const width = event.currentTarget.offsetWidth
        const height = event.currentTarget.offsetHeight
        const rawX = event.clientX - dragRef.current.offsetX
        const rawY = event.clientY - dragRef.current.offsetY
        const x = Math.min(Math.max(rawX, 0), window.innerWidth - width)
        const y = Math.min(Math.max(rawY, 0), window.innerHeight - height)
        setPosition({ x, y })
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId)
        dragRef.current = null
        setDragging(false)
      }}
      onPointerCancel={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId)
        dragRef.current = null
        setDragging(false)
      }}
    >
      <video
        ref={videoRef}
        muted
        autoPlay
        playsInline
        data-testid="self-tile-video"
        className="h-full w-full object-cover"
      />
    </div>
  )
}
