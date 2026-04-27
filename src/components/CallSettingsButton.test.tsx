import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useCallStore } from "@/store/call"
import { CallSettingsButton } from "./CallSettingsButton"

const mockApplyPreset = vi.fn()

describe("CallSettingsButton", () => {
  beforeEach(() => {
    useCallStore.getState().reset()
    useCallStore.setState({ screenSharePreset: "auto", isScreenSharing: false })
    mockApplyPreset.mockClear()
    window.localStorage.clear()
  })

  it("renders a trigger button with a descriptive aria-label", () => {
    render(<CallSettingsButton onApplyScreenSharePreset={mockApplyPreset} />)
    expect(screen.getByRole("button", { name: /call settings/i })).toBeInTheDocument()
  })

  it("opens a popover with three radio options on click (Auto, Video, Text)", () => {
    render(<CallSettingsButton onApplyScreenSharePreset={mockApplyPreset} />)
    fireEvent.click(screen.getByRole("button", { name: /call settings/i }))
    expect(screen.getByRole("radio", { name: /auto/i })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /video/i })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /text/i })).toBeInTheDocument()
  })

  it("shows the 'applies to next share' helper when not screen sharing", () => {
    render(<CallSettingsButton onApplyScreenSharePreset={mockApplyPreset} />)
    fireEvent.click(screen.getByRole("button", { name: /call settings/i }))
    expect(screen.getByText(/applies to your next screen share/i)).toBeInTheDocument()
  })

  it("shows the 'updates live' helper when screen sharing", () => {
    useCallStore.setState({ isScreenSharing: true })
    render(<CallSettingsButton onApplyScreenSharePreset={mockApplyPreset} />)
    fireEvent.click(screen.getByRole("button", { name: /call settings/i }))
    expect(screen.getByText(/updates live/i)).toBeInTheDocument()
  })

  it("selecting an option updates the store and localStorage", () => {
    render(<CallSettingsButton onApplyScreenSharePreset={mockApplyPreset} />)
    fireEvent.click(screen.getByRole("button", { name: /call settings/i }))
    fireEvent.click(screen.getByRole("radio", { name: /text/i }))

    expect(useCallStore.getState().screenSharePreset).toBe("text")
    expect(window.localStorage.getItem("ripple.screenSharePreset")).toBe("text")
  })

  it("calls onApplyScreenSharePreset when isScreenSharing is true", () => {
    useCallStore.setState({ isScreenSharing: true })
    render(<CallSettingsButton onApplyScreenSharePreset={mockApplyPreset} />)
    fireEvent.click(screen.getByRole("button", { name: /call settings/i }))
    fireEvent.click(screen.getByRole("radio", { name: /video/i }))

    expect(mockApplyPreset).toHaveBeenCalledTimes(1)
    expect(mockApplyPreset).toHaveBeenCalledWith("video")
  })

  it("does not call onApplyScreenSharePreset when isScreenSharing is false", () => {
    render(<CallSettingsButton onApplyScreenSharePreset={mockApplyPreset} />)
    fireEvent.click(screen.getByRole("button", { name: /call settings/i }))
    fireEvent.click(screen.getByRole("radio", { name: /text/i }))

    expect(mockApplyPreset).not.toHaveBeenCalled()
  })
})
