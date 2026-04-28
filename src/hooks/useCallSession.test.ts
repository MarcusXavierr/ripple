import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CallSession } from "@/lib/call/CallSession"
import { useCallStore } from "@/store/call"
import { samplePeerKeyboardInput } from "@/testing/peerKeyboardInput.fixture"
import { samplePeerVideoClick } from "@/testing/peerVideoClick.fixture"
import { samplePeerVideoScroll } from "@/testing/peerVideoScroll.fixture"
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
      sendPeerVideoClick: vi.fn(),
      sendPeerVideoScroll: vi.fn(),
      sendPeerKeyboardInput: vi.fn(),
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

it("delegates sendPeerVideoClick to the session", () => {
  const { result } = renderHook(() => useCallSession("test-room"))
  const session = vi.mocked(CallSession).mock.results[0]?.value

  act(() => result.current.sendPeerVideoClick(samplePeerVideoClick))

  expect(session.sendPeerVideoClick).toHaveBeenCalledWith(samplePeerVideoClick)
})

it("delegates sendPeerVideoScroll to the session", () => {
  const { result } = renderHook(() => useCallSession("test-room"))
  const session = vi.mocked(CallSession).mock.results[0]?.value

  act(() => result.current.sendPeerVideoScroll(samplePeerVideoScroll))

  expect(session.sendPeerVideoScroll).toHaveBeenCalledWith(samplePeerVideoScroll)
})

it("delegates sendPeerKeyboardInput to the session", () => {
  const { result } = renderHook(() => useCallSession("test-room"))
  const session = vi.mocked(CallSession).mock.results[0]?.value

  act(() => result.current.sendPeerKeyboardInput(samplePeerKeyboardInput))

  expect(session.sendPeerKeyboardInput).toHaveBeenCalledWith(samplePeerKeyboardInput)
})

it("keeps remote input actions stable across store-driven rerenders", () => {
  const { result } = renderHook(() => useCallSession("test-room"))
  const firstSendPeerVideoClick = result.current.sendPeerVideoClick
  const firstSendPeerVideoScroll = result.current.sendPeerVideoScroll

  act(() => {
    useCallStore.setState({ status: "connected" })
  })

  expect(result.current.sendPeerVideoClick).toBe(firstSendPeerVideoClick)
  expect(result.current.sendPeerVideoScroll).toBe(firstSendPeerVideoScroll)
})

it("exposes the mediaController from the session", () => {
  const { result } = renderHook(() => useCallSession("test-room"))
  const session = vi.mocked(CallSession).mock.results[0]?.value

  expect(result.current.mediaController).toBe(session.media)
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
