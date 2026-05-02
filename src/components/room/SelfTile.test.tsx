import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SelfTile } from "./SelfTile"

beforeEach(() => {
  Object.defineProperty(HTMLDivElement.prototype, "setPointerCapture", {
    value: vi.fn(),
    configurable: true,
  })
  Object.defineProperty(HTMLDivElement.prototype, "releasePointerCapture", {
    value: vi.fn(),
    configurable: true,
  })
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

  it("renders at the default lower-right position on first mount", () => {
    render(<SelfTile stream={null} />)

    expect(screen.getByTestId("self-tile")).toHaveStyle({
      bottom: "100px",
      right: "16px",
    })
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

    expect(tile).toHaveStyle({ left: "280px", top: "180px" })
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
    expect(screen.getByTestId("self-tile")).toHaveStyle({ left: "280px", top: "180px" })

    unmount()
    render(<SelfTile stream={null} />)
    expect(screen.getByTestId("self-tile")).toHaveStyle({ bottom: "100px", right: "16px" })
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

    expect(tile).toHaveStyle({ left: "608px", top: "456px" })
  })
})
