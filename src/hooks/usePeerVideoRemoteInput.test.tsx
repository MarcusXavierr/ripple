import type { PeerKeyboardInput } from "@shared/remoteInputProtocol"
import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRef } from "react"
import { samplePeerVideoClick } from "@/testing/peerVideoClick.fixture"
import { samplePeerVideoScroll } from "@/testing/peerVideoScroll.fixture"
import { usePeerVideoRemoteInput } from "./usePeerVideoRemoteInput"

const createPeerVideoClickMock = vi.fn()
const createPeerVideoScrollMock = vi.fn()
const scrollCoalescerPushMock = vi.fn()
const scrollCoalescerDisposeMock = vi.fn()
const createPeerVideoScrollCoalescerMock = vi.fn()
let coalescerSend: ((scroll: typeof samplePeerVideoScroll) => void) | null = null

vi.mock("@/lib/call/createPeerVideoInput", () => ({
  createPeerVideoClick: (...args: unknown[]) => createPeerVideoClickMock(...args),
  createPeerVideoScroll: (...args: unknown[]) => createPeerVideoScrollMock(...args),
}))

vi.mock("@/lib/call/coalescePeerVideoScroll", () => ({
  createPeerVideoScrollCoalescer: (...args: unknown[]) =>
    createPeerVideoScrollCoalescerMock(...args),
}))

type HarnessProps = {
  sendPeerVideoClick?: (click: typeof samplePeerVideoClick) => void
  sendPeerVideoScroll?: (scroll: typeof samplePeerVideoScroll) => void
}

function PeerVideoRemoteInputHarness({
  sendPeerVideoClick = vi.fn(),
  sendPeerVideoScroll = vi.fn(),
}: HarnessProps) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const { handleRemoteVideoClick } = usePeerVideoRemoteInput({
    remoteVideoRef,
    sendPeerVideoClick,
    sendPeerVideoScroll,
    sendPeerKeyboardInput: vi.fn(),
  })

  return <video ref={remoteVideoRef} data-testid="remote-video" onClick={handleRemoteVideoClick} />
}

function KeyboardHarness({
  sendPeerKeyboardInput,
}: {
  sendPeerKeyboardInput: (input: PeerKeyboardInput) => void
}) {
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const { handleRemoteVideoClick } = usePeerVideoRemoteInput({
    remoteVideoRef,
    sendPeerVideoClick: vi.fn(),
    sendPeerVideoScroll: vi.fn(),
    sendPeerKeyboardInput,
  })

  return (
    <>
      <video ref={remoteVideoRef} data-testid="remote-video" onClick={handleRemoteVideoClick} />
      <button type="button">local control</button>
    </>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  coalescerSend = null
  createPeerVideoScrollCoalescerMock.mockImplementation((send) => {
    coalescerSend = send
    return {
      push: scrollCoalescerPushMock,
      dispose: scrollCoalescerDisposeMock,
    }
  })
})

it("forwards remote video clicks through the geometry helper", () => {
  const sendPeerVideoClick = vi.fn()
  createPeerVideoClickMock.mockReturnValue(samplePeerVideoClick)
  render(<PeerVideoRemoteInputHarness sendPeerVideoClick={sendPeerVideoClick} />)
  const remoteVideo = screen.getByTestId("remote-video")

  fireEvent.click(remoteVideo, { clientX: 120, clientY: 45 })

  expect(createPeerVideoClickMock).toHaveBeenCalledWith(remoteVideo, {
    clientX: 120,
    clientY: 45,
  })
  expect(sendPeerVideoClick).toHaveBeenCalledWith(samplePeerVideoClick)
})

it("does not forward rejected remote video clicks", () => {
  const sendPeerVideoClick = vi.fn()
  createPeerVideoClickMock.mockReturnValue(null)
  render(<PeerVideoRemoteInputHarness sendPeerVideoClick={sendPeerVideoClick} />)

  fireEvent.click(screen.getByTestId("remote-video"), { clientX: 120, clientY: 45 })

  expect(sendPeerVideoClick).not.toHaveBeenCalled()
})

it("coalesces remote video wheel events and prevents default", () => {
  createPeerVideoScrollMock.mockReturnValue(samplePeerVideoScroll)
  render(<PeerVideoRemoteInputHarness />)
  const remoteVideo = screen.getByTestId("remote-video")
  const event = new WheelEvent("wheel", {
    clientX: 120,
    clientY: 45,
    deltaX: 2,
    deltaY: 30,
    deltaMode: 0,
    cancelable: true,
  })

  fireEvent(remoteVideo, event)

  expect(event.defaultPrevented).toBe(true)
  expect(createPeerVideoScrollMock).toHaveBeenCalledWith(remoteVideo, {
    clientX: 120,
    clientY: 45,
    deltaX: 2,
    deltaY: 30,
    deltaMode: 0,
  })
  expect(scrollCoalescerPushMock).toHaveBeenCalledWith(samplePeerVideoScroll)
})

it("does not coalesce wheel events rejected by the geometry helper", () => {
  createPeerVideoScrollMock.mockReturnValue(null)
  render(<PeerVideoRemoteInputHarness />)

  fireEvent.wheel(screen.getByTestId("remote-video"), { clientX: 1, clientY: 1, deltaY: 10 })

  expect(scrollCoalescerPushMock).not.toHaveBeenCalled()
})

it("keeps the same coalescer across rerenders and flushes through the latest sender", () => {
  const firstSendPeerVideoScroll = vi.fn()
  const secondSendPeerVideoScroll = vi.fn()
  const { rerender } = render(
    <PeerVideoRemoteInputHarness sendPeerVideoScroll={firstSendPeerVideoScroll} />
  )

  rerender(<PeerVideoRemoteInputHarness sendPeerVideoScroll={secondSendPeerVideoScroll} />)

  expect(createPeerVideoScrollCoalescerMock).toHaveBeenCalledTimes(1)
  expect(scrollCoalescerDisposeMock).not.toHaveBeenCalled()

  act(() => coalescerSend?.(samplePeerVideoScroll))

  expect(firstSendPeerVideoScroll).not.toHaveBeenCalled()
  expect(secondSendPeerVideoScroll).toHaveBeenCalledWith(samplePeerVideoScroll)
})

it("disposes the scroll coalescer on unmount", () => {
  const { unmount } = render(<PeerVideoRemoteInputHarness />)

  unmount()

  expect(scrollCoalescerDisposeMock).toHaveBeenCalledTimes(1)
})

describe("usePeerVideoRemoteInput keyboard capture", () => {
  it("sends allowed keys only after the remote video arms keyboard capture", async () => {
    const user = userEvent.setup()
    const sendPeerKeyboardInput = vi.fn()
    render(<KeyboardHarness sendPeerKeyboardInput={sendPeerKeyboardInput} />)

    await user.keyboard("a")
    expect(sendPeerKeyboardInput).not.toHaveBeenCalled()

    await user.click(screen.getByTestId("remote-video"))
    await user.keyboard("a")

    expect(sendPeerKeyboardInput).toHaveBeenCalledWith({
      key: "a",
      code: "KeyA",
      location: 0,
      repeat: false,
    })
  })

  it("disarms keyboard capture after clicking outside the remote video", async () => {
    const user = userEvent.setup()
    const sendPeerKeyboardInput = vi.fn()
    render(<KeyboardHarness sendPeerKeyboardInput={sendPeerKeyboardInput} />)

    await user.click(screen.getByTestId("remote-video"))
    await user.click(screen.getByRole("button", { name: "local control" }))
    await user.keyboard("a")

    expect(sendPeerKeyboardInput).not.toHaveBeenCalled()
  })

  it("ignores shortcuts and disallowed keys", async () => {
    const user = userEvent.setup()
    const sendPeerKeyboardInput = vi.fn()
    render(<KeyboardHarness sendPeerKeyboardInput={sendPeerKeyboardInput} />)

    await user.click(screen.getByTestId("remote-video"))
    await user.keyboard("{Control>}a{/Control}")
    await user.keyboard("{Tab}")
    await user.keyboard("{ArrowLeft}")

    expect(sendPeerKeyboardInput).not.toHaveBeenCalled()
  })
})
