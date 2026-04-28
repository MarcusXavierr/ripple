// src/pages/Room.test.tsx
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { toast } from "@/components/ui/toast"
import { useCallSession } from "@/hooks/useCallSession"
import { useDevices } from "@/hooks/useDevices"
import { usePeerVideoRemoteInput } from "@/hooks/usePeerVideoRemoteInput"
import Room from "./Room"

vi.mock("@/hooks/useCallSession", () => ({ useCallSession: vi.fn() }))
vi.mock("@/hooks/usePeerVideoRemoteInput", () => ({ usePeerVideoRemoteInput: vi.fn() }))
vi.mock("@/hooks/useDevices", () => ({ useDevices: vi.fn() }))
vi.mock("@/components/ui/toast", () => ({ toast: vi.fn() }))

const handleRemoteVideoClickMock = vi.fn()
const writeText = vi.fn()

const baseMock = {
  localStream: null as MediaStream | null,
  remoteStream: null as MediaStream | null,
  status: "waiting" as const,
  error: null as string | null,
  showReconnectModal: false,
  mediaController: null,
  isScreenSharing: false,
  isMicMuted: false,
  isCameraOff: false,
  startScreenShare: vi.fn(),
  stopScreenShare: vi.fn(),
  hangup: vi.fn(),
  toggleMic: vi.fn(),
  toggleCamera: vi.fn(),
  sendPeerVideoClick: vi.fn(),
  sendPeerVideoScroll: vi.fn(),
  sendPeerKeyboardInput: vi.fn(),
  dismissError: vi.fn(),
  dismissReconnectModal: vi.fn(),
}

function renderRoom(roomId = "coral-tiger-42") {
  return render(
    <MemoryRouter initialEntries={[`/room/${roomId}`]}>
      <Routes>
        <Route path="/room/:id" element={<Room />} />
      </Routes>
    </MemoryRouter>
  )
}

const useCallSessionMock = useCallSession as ReturnType<typeof vi.fn>
const usePeerVideoRemoteInputMock = usePeerVideoRemoteInput as ReturnType<typeof vi.fn>
const useDevicesMock = useDevices as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  useCallSessionMock.mockReturnValue({ ...baseMock })
  usePeerVideoRemoteInputMock.mockReturnValue({
    handleRemoteVideoClick: handleRemoteVideoClickMock,
  })
  useDevicesMock.mockReturnValue({
    devices: { mic: [], cam: [], speaker: [] },
    selected: { mic: "", cam: "", speaker: "" },
    selectDevice: vi.fn(),
    requestPermission: vi.fn(),
    permissionGranted: true,
    speakerSupported: false,
  })
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  })
  writeText.mockResolvedValue(undefined)
  Object.defineProperty(HTMLMediaElement.prototype, "setSinkId", {
    value: vi.fn().mockResolvedValue(undefined),
    configurable: true,
  })
  Object.defineProperty(HTMLDivElement.prototype, "setPointerCapture", {
    value: vi.fn(),
    configurable: true,
  })
  Object.defineProperty(HTMLDivElement.prototype, "releasePointerCapture", {
    value: vi.fn(),
    configurable: true,
  })
})

it("renders the room page", () => {
  renderRoom()
  expect(screen.getByTestId("room-page")).toBeInTheDocument()
})

describe("waiting state", () => {
  it("shows waiting overlay text", () => {
    renderRoom()
    expect(screen.getByText(/waiting for someone to join/i)).toBeInTheDocument()
  })

  it("shows the room ID", () => {
    renderRoom("coral-tiger-42")
    const roomIds = screen.getAllByText("coral-tiger-42")
    expect(roomIds.length).toBeGreaterThan(0)
  })

  it("renders a Copy link button", () => {
    renderRoom()
    expect(screen.getByRole("button", { name: /copy link/i })).toBeInTheDocument()
  })
})

describe("status bar", () => {
  it('shows "Waiting for peer..." when status is waiting', () => {
    renderRoom()
    expect(screen.getByText("Waiting for peer...")).toBeInTheDocument()
  })

  it('shows "Connected" when status is connected', () => {
    useCallSessionMock.mockReturnValue({ ...baseMock, status: "connected" })
    renderRoom()
    expect(screen.getByText("Connected")).toBeInTheDocument()
  })
})

describe("control bar", () => {
  it("wires the remote video sender hook with the session callbacks", () => {
    renderRoom()
    const remoteVideo = screen.getByTestId("remote-video")

    const [args] = usePeerVideoRemoteInputMock.mock.calls[0]
    expect(args.remoteVideoRef.current).toBe(remoteVideo)
    expect(args.sendPeerVideoClick).toBe(baseMock.sendPeerVideoClick)
    expect(args.sendPeerVideoScroll).toBe(baseMock.sendPeerVideoScroll)
    expect(handleRemoteVideoClickMock).not.toHaveBeenCalled()
  })

  it("forwards remote video clicks through the extracted sender hook", () => {
    renderRoom()

    fireEvent.click(screen.getByTestId("remote-video"), { clientX: 120, clientY: 45 })

    expect(handleRemoteVideoClickMock).toHaveBeenCalledTimes(1)
  })

  it("ignores clicks on the local self-view video", async () => {
    renderRoom()

    await userEvent.click(screen.getByTestId("self-tile-video"))

    expect(handleRemoteVideoClickMock).not.toHaveBeenCalled()
  })

  it("renders redesigned controls", () => {
    renderRoom()
    expect(screen.getByRole("button", { name: /mute/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /turn off camera/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /share screen/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /leave call/i })).toBeInTheDocument()
  })

  it("calls toggleMic on mic button click", async () => {
    renderRoom()
    await userEvent.click(screen.getByRole("button", { name: /mute/i }))
    expect(baseMock.toggleMic).toHaveBeenCalled()
  })

  it("calls toggleCamera on camera button click", async () => {
    renderRoom()
    await userEvent.click(screen.getByRole("button", { name: /turn off camera/i }))
    expect(baseMock.toggleCamera).toHaveBeenCalled()
  })

  it("calls hangup on hang up button click", async () => {
    renderRoom()
    await userEvent.click(screen.getByRole("button", { name: /leave call/i }))
    expect(baseMock.hangup).toHaveBeenCalled()
  })

  it("calls startScreenShare when not sharing", async () => {
    useCallSessionMock.mockReturnValue({ ...baseMock, isScreenSharing: false })
    renderRoom()
    await userEvent.click(screen.getByRole("button", { name: /share screen/i }))
    expect(baseMock.startScreenShare).toHaveBeenCalled()
  })

  it("calls stopScreenShare when sharing", async () => {
    useCallSessionMock.mockReturnValue({ ...baseMock, isScreenSharing: true })
    renderRoom()
    await userEvent.click(screen.getByRole("button", { name: /stop sharing/i }))
    expect(baseMock.stopScreenShare).toHaveBeenCalled()
  })

  it("shows Unmute label when mic is muted", () => {
    useCallSessionMock.mockReturnValue({ ...baseMock, isMicMuted: true })
    renderRoom()
    expect(screen.getByRole("button", { name: /unmute/i })).toBeInTheDocument()
  })

  it("shows Enable camera label when camera is off", () => {
    useCallSessionMock.mockReturnValue({ ...baseMock, isCameraOff: true })
    renderRoom()
    expect(screen.getByRole("button", { name: /turn on camera/i })).toBeInTheDocument()
  })
})

it("clicking the StatusPill copies the room URL and dispatches a success toast", async () => {
  renderRoom()

  await userEvent.click(screen.getByRole("button", { name: /status:/i }))

  expect(writeText).toHaveBeenCalledWith("http://localhost:3000/room/coral-tiger-42")
  expect(toast).toHaveBeenCalledWith("Link copied", "success")
})

it("speaker selection effect calls setSinkId on the remote video element", () => {
  const setSinkId = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(HTMLMediaElement.prototype, "setSinkId", {
    value: setSinkId,
    configurable: true,
  })
  useDevicesMock.mockReturnValue({
    devices: { mic: [], cam: [], speaker: [{ id: "speaker-2", label: "Speaker 2" }] },
    selected: { mic: "", cam: "", speaker: "speaker-2" },
    selectDevice: vi.fn(),
    requestPermission: vi.fn(),
    permissionGranted: true,
    speakerSupported: true,
  })

  renderRoom()

  expect(setSinkId).toHaveBeenCalledWith("speaker-2")
})

describe("error modal", () => {
  it("shows dialog when error is set", () => {
    useCallSessionMock.mockReturnValue({ ...baseMock, error: "This room is full." })
    renderRoom()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("This room is full.")).toBeInTheDocument()
  })

  it("does not show dialog when error is null", () => {
    renderRoom()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("calls dismissError when OK is clicked", async () => {
    useCallSessionMock.mockReturnValue({ ...baseMock, error: "This room is full." })
    renderRoom()
    await userEvent.click(screen.getByRole("button", { name: /ok/i }))
    expect(baseMock.dismissError).toHaveBeenCalled()
  })
})
