import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ToastContainer, toast } from "./toast"

describe("toast", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it("renders info toast at top-right with accent stripe and progress bar", () => {
    render(<ToastContainer />)

    act(() => {
      toast("Network steady")
    })

    const status = screen.getByRole("status")
    expect(status.parentElement).toHaveClass("pointer-events-auto")
    expect(status.parentElement?.parentElement).toHaveClass("top-6", "right-6")
    expect(screen.getByTestId("toast-stripe-info")).toHaveClass("bg-blue-500")
    expect(status).toHaveAttribute("aria-live", "polite")
    expect(screen.getByTestId(/toast-progress-/)).toHaveStyle({ animationDuration: "4000ms" })
  })

  it("auto-dismisses after default 4s", () => {
    render(<ToastContainer />)

    act(() => {
      toast("Bye")
    })

    expect(screen.getByText("Bye")).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(screen.queryByText("Bye")).not.toBeInTheDocument()
  })

  it("click-dismiss plays leaving animation then unmounts", () => {
    render(<ToastContainer />)

    act(() => {
      toast("Dismiss me")
    })

    const card = screen.getByRole("status")
    act(() => {
      fireEvent.click(card)
    })
    expect(card.className).toContain("toast-out")

    act(() => {
      vi.advanceTimersByTime(280)
    })

    expect(screen.queryByText("Dismiss me")).not.toBeInTheDocument()
  })

  it("stacks multiple toasts vertically in dispatch order", () => {
    render(<ToastContainer />)

    act(() => {
      toast("First")
      toast("Second", "success")
    })

    const wrappers = screen
      .getByText("First")
      .closest(".pointer-events-auto")
      ?.parentElement?.querySelectorAll(".pointer-events-auto")

    expect(wrappers).toHaveLength(2)
    expect(screen.getAllByRole("status").map((node) => node.textContent)).toEqual([
      expect.stringContaining("First"),
      expect.stringContaining("Second"),
    ])
  })

  it("each variant uses correct accent and icon", () => {
    render(<ToastContainer />)

    act(() => {
      toast("Info", "info")
      toast("Success", "success")
      toast("Warning", "warning")
      toast("Error", "error")
    })

    expect(screen.getByTestId("toast-stripe-info")).toHaveClass("bg-blue-500")
    expect(screen.getByTestId("toast-icon-info")).toBeInTheDocument()
    expect(screen.getByTestId("toast-stripe-success")).toHaveClass("bg-emerald-500")
    expect(screen.getByTestId("toast-icon-success")).toBeInTheDocument()
    expect(screen.getByTestId("toast-stripe-warning")).toHaveClass("bg-amber-500")
    expect(screen.getByTestId("toast-icon-warning")).toBeInTheDocument()
    expect(screen.getByTestId("toast-stripe-error")).toHaveClass("bg-rose-500")
    expect(screen.getByTestId("toast-icon-error")).toBeInTheDocument()
  })

  it("warning/error use role=alert and aria-live=assertive", () => {
    render(<ToastContainer />)

    act(() => {
      toast("Warn", "warning")
      toast("Err", "error")
    })

    for (const alert of screen.getAllByRole("alert")) {
      expect(alert).toHaveAttribute("aria-live", "assertive")
    }
  })

  it("custom duration overrides default", () => {
    render(<ToastContainer />)

    act(() => {
      toast({ message: "Long one", duration: 8000 })
    })

    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.getByText("Long one")).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.queryByText("Long one")).not.toBeInTheDocument()
  })

  it("emitter survives across renders / route navigation", () => {
    const { rerender } = render(
      <div>
        <ToastContainer />
        <div>route-a</div>
      </div>,
    )

    act(() => {
      toast("Persistent")
    })

    rerender(
      <div>
        <ToastContainer />
        <div>route-b</div>
      </div>,
    )

    expect(screen.getByText("Persistent")).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(screen.queryByText("Persistent")).not.toBeInTheDocument()
  })
})
