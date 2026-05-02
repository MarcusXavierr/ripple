import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { StatusPill } from "./StatusPill"

const writeText = vi.fn()
const toastMock = vi.fn()

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      (
        ({
          "room.status.idle": "Idle",
          "room.status.connecting": "Connecting",
          "room.status.waiting": "Waiting for peer...",
          "room.status.negotiating": "Negotiating",
          "room.status.connected": "Connected",
          "room.status.reconnecting": "Reconnecting...",
          "room.status.disconnected": "Disconnected",
          "room.status.ended": "Ended",
          "room.toast.linkCopied": "Link copied",
          "room.status.copyLinkAria": `Status: ${options?.status}, room ${options?.roomId}, click to copy room link`,
        }) as Record<string, string>
      )[key] ?? key,
  }),
}))

vi.mock("@/components/ui/toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-04-28T12:00:00Z"))
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  })
  writeText.mockResolvedValue(undefined)
  toastMock.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("StatusPill", () => {
  it("shows 'Connecting' label and amber dot when status=connecting and no timer", () => {
    render(<StatusPill roomId="coral-42" status="connecting" />)

    expect(screen.getByText("Connecting")).toBeInTheDocument()
    expect(document.querySelector(".bg-amber-400")).toBeInTheDocument()
    expect(screen.queryByText("00:00")).not.toBeInTheDocument()
  })

  it("shows 'Connected' label, green dot, and 00:00 timer immediately on connection", () => {
    render(<StatusPill roomId="coral-42" status="connected" />)

    expect(screen.getByText("Connected")).toBeInTheDocument()
    expect(document.querySelector(".bg-emerald-400")).toBeInTheDocument()
    expect(screen.getByText("00:00")).toBeInTheDocument()
  })

  it("timer increments to 00:30 after 30 seconds connected", () => {
    render(<StatusPill roomId="coral-42" status="connected" />)

    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    expect(screen.getByText("00:30")).toBeInTheDocument()
  })

  it("timer freezes when status changes to reconnecting and dot turns amber", () => {
    const { rerender } = render(<StatusPill roomId="coral-42" status="connected" />)

    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    rerender(<StatusPill roomId="coral-42" status="reconnecting" />)
    act(() => {
      vi.advanceTimersByTime(10_000)
    })

    expect(screen.getByText("00:30")).toBeInTheDocument()
    expect(document.querySelector(".bg-amber-400")).toBeInTheDocument()
  })

  it("timer resumes from frozen value when status returns to connected", () => {
    const { rerender } = render(<StatusPill roomId="coral-42" status="connected" />)

    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    rerender(<StatusPill roomId="coral-42" status="reconnecting" />)
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    rerender(<StatusPill roomId="coral-42" status="connected" />)
    act(() => {
      vi.advanceTimersByTime(5_000)
    })

    expect(screen.getByText("00:35")).toBeInTheDocument()
  })

  it("clicking pill copies the full room URL and dispatches success toast", async () => {
    render(<StatusPill roomId="coral-42" status="connected" />)

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /status: connected/i }))
    })

    expect(writeText).toHaveBeenCalledWith("http://localhost:3000/room/coral-42")
    expect(toastMock).toHaveBeenCalledWith("Link copied", "success")
  })
})
