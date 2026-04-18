import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useCallStore } from "@/store/call"
import { useCallSession } from "./useCallSession"

const mockNavigate = vi.fn()

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock("@/lib/call/CallSession", () => ({
  // biome-ignore lint/complexity/useArrowFunction: constructor mock requires function expression
  CallSession: vi.fn().mockImplementation(function () {
    return {
      start: vi.fn(),
      teardown: vi.fn(),
      hangup: vi.fn(),
      media: {
        toggleMic: vi.fn(),
        toggleCamera: vi.fn(),
        startScreenShare: vi.fn(),
        stopScreenShare: vi.fn(),
      },
    }
  }),
}))

beforeEach(() => {
  useCallStore.getState().reset()
  mockNavigate.mockClear()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("dismissError", () => {
  it("clears the error", () => {
    useCallStore.setState({ error: "Some error" })
    const { result } = renderHook(() => useCallSession("test-room"))
    act(() => result.current.dismissError())
    expect(useCallStore.getState().error).toBeNull()
  })

  it("navigates to / for room-full error", () => {
    useCallStore.setState({ error: "This room is full. Only two participants are allowed." })
    const { result } = renderHook(() => useCallSession("test-room"))
    act(() => result.current.dismissError())
    expect(mockNavigate).toHaveBeenCalledWith("/")
  })

  it("navigates to / for room-not-found error", () => {
    useCallStore.setState({ error: "This room doesn't exist." })
    const { result } = renderHook(() => useCallSession("test-room"))
    act(() => result.current.dismissError())
    expect(mockNavigate).toHaveBeenCalledWith("/")
  })

  it("navigates to / for duplicate-session error", () => {
    useCallStore.setState({ error: "You're connected to this room from another tab." })
    const { result } = renderHook(() => useCallSession("test-room"))
    act(() => result.current.dismissError())
    expect(mockNavigate).toHaveBeenCalledWith("/")
  })

  it("navigates to / for unable-to-connect error", () => {
    useCallStore.setState({ error: "Unable to connect to the server." })
    const { result } = renderHook(() => useCallSession("test-room"))
    act(() => result.current.dismissError())
    expect(mockNavigate).toHaveBeenCalledWith("/")
  })

  it("does not navigate for media-denied error", () => {
    useCallStore.setState({ error: "Camera and microphone access is required to join a call." })
    const { result } = renderHook(() => useCallSession("test-room"))
    act(() => result.current.dismissError())
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
