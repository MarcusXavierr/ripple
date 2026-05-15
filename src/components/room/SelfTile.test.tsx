import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SelfTile } from "./SelfTile"

beforeEach(() => {
  Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
    configurable: true,
    get() {
      return this._srcObject
    },
    set(value) {
      this._srcObject = value
    },
  })
  Object.defineProperty(window, "innerWidth", { value: 800, configurable: true })
  Object.defineProperty(window, "innerHeight", { value: 600, configurable: true })
})

describe("SelfTile", () => {
  it("renders local stream as srcObject on the inner video", () => {
    const stream = { id: "local-stream" } as unknown as MediaStream
    render(<SelfTile stream={stream} />)

    expect(screen.getByTestId("self-tile-video")).toHaveProperty("srcObject", stream)
  })

  it("renders with responsive default lower-right placement before dragging", () => {
    render(<SelfTile stream={null} />)

    const tile = screen.getByTestId("self-tile")

    expect(tile.className).toContain("right-3")
    expect(tile.className).toContain("bottom-[calc(env(safe-area-inset-bottom)+5rem)]")
    expect(tile.className).toContain("h-24")
    expect(tile.className).toContain("w-32")
    expect(tile.className).toContain("sm:right-4")
    expect(tile.className).toContain("sm:bottom-[100px]")
    expect(tile.className).toContain("sm:h-36")
    expect(tile.className).toContain("sm:w-48")
    expect(tile).not.toHaveStyle({ bottom: "100px", right: "16px" })
  })

  it("has touch-none class so the browser doesn't steal touch gestures for scroll", () => {
    render(<SelfTile stream={null} />)
    const tile = screen.getByTestId("self-tile")
    expect(tile.className).toContain("touch-none")
  })

  it("pointer down/move/up updates the tile's position to the move target", () => {
    render(<SelfTile stream={null} />)
    const tile = screen.getByTestId("self-tile")
    Object.defineProperty(tile, "offsetWidth", { value: 192, configurable: true })
    Object.defineProperty(tile, "offsetHeight", { value: 144, configurable: true })
    vi.spyOn(tile, "getBoundingClientRect").mockReturnValue({
      left: 600,
      top: 300,
      right: 792,
      bottom: 444,
      width: 192,
      height: 144,
      x: 600,
      y: 300,
      toJSON: () => ({}),
    })

    fireEvent.pointerDown(tile, { pointerId: 1, clientX: 620, clientY: 320 })
    fireEvent.pointerMove(tile, { pointerId: 1, clientX: 300, clientY: 200 })
    fireEvent.pointerUp(tile, { pointerId: 1, clientX: 300, clientY: 200 })

    expect(tile.style.transform).toBe("translate3d(280px, 180px, 0)")
  })

  it("position is preserved between drag end and next render but reset on unmount/remount", () => {
    const { rerender, unmount } = render(<SelfTile stream={null} />)
    const tile = screen.getByTestId("self-tile")
    Object.defineProperty(tile, "offsetWidth", { value: 192, configurable: true })
    Object.defineProperty(tile, "offsetHeight", { value: 144, configurable: true })
    vi.spyOn(tile, "getBoundingClientRect").mockReturnValue({
      left: 600,
      top: 300,
      right: 792,
      bottom: 444,
      width: 192,
      height: 144,
      x: 600,
      y: 300,
      toJSON: () => ({}),
    })

    fireEvent.pointerDown(tile, { pointerId: 1, clientX: 620, clientY: 320 })
    fireEvent.pointerMove(tile, { pointerId: 1, clientX: 300, clientY: 200 })
    fireEvent.pointerUp(tile, { pointerId: 1, clientX: 300, clientY: 200 })

    rerender(<SelfTile stream={null} />)
    expect(screen.getByTestId("self-tile").style.transform).toBe("translate3d(280px, 180px, 0)")

    unmount()
    render(<SelfTile stream={null} />)
    const remountedTile = screen.getByTestId("self-tile")
    expect(remountedTile.className).toContain("right-3")
    expect(remountedTile.className).toContain("bottom-[calc(env(safe-area-inset-bottom)+5rem)]")
    expect(remountedTile.className).toContain("sm:bottom-[100px]")
    expect(remountedTile.style.transform).toBe("")
  })

  it("clamps position to viewport bounds on drag past edges", () => {
    render(<SelfTile stream={null} />)
    const tile = screen.getByTestId("self-tile")
    Object.defineProperty(tile, "offsetWidth", { value: 192, configurable: true })
    Object.defineProperty(tile, "offsetHeight", { value: 144, configurable: true })
    vi.spyOn(tile, "getBoundingClientRect").mockReturnValue({
      left: 600,
      top: 300,
      right: 792,
      bottom: 444,
      width: 192,
      height: 144,
      x: 600,
      y: 300,
      toJSON: () => ({}),
    })

    fireEvent.pointerDown(tile, { pointerId: 1, clientX: 620, clientY: 320 })
    fireEvent.pointerMove(tile, { pointerId: 1, clientX: 10_000, clientY: 10_000 })
    fireEvent.pointerUp(tile, { pointerId: 1, clientX: 10_000, clientY: 10_000 })

    expect(tile.style.transform).toBe("translate3d(608px, 456px, 0)")
  })
})
