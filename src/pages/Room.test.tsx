// src/pages/Room.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useCallSession } from '@/hooks/useCallSession'
import Room from './Room'

vi.mock('@/hooks/useCallSession', () => ({ useCallSession: vi.fn() }))

const baseMock = {
  localStream: null as MediaStream | null,
  remoteStream: null as MediaStream | null,
  status: 'waiting' as const,
  error: null as string | null,
  isScreenSharing: false,
  isMicMuted: false,
  isCameraOff: false,
  startScreenShare: vi.fn(),
  stopScreenShare: vi.fn(),
  hangup: vi.fn(),
  toggleMic: vi.fn(),
  toggleCamera: vi.fn(),
  dismissError: vi.fn(),
}

function renderRoom(roomId = 'coral-tiger-42') {
  return render(
    <MemoryRouter initialEntries={[`/room/${roomId}`]}>
      <Routes>
        <Route path="/room/:id" element={<Room />} />
      </Routes>
    </MemoryRouter>,
  )
}

const useCallSessionMock = useCallSession as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  useCallSessionMock.mockReturnValue({ ...baseMock })
})

it('renders the room page', () => {
  renderRoom()
  expect(screen.getByTestId('room-page')).toBeInTheDocument()
})

describe('waiting state', () => {
  it('shows waiting overlay text', () => {
    renderRoom()
    expect(screen.getByText(/waiting for someone to join/i)).toBeInTheDocument()
  })

  it('shows the room ID', () => {
    renderRoom('coral-tiger-42')
    const roomIds = screen.getAllByText('coral-tiger-42')
    expect(roomIds.length).toBeGreaterThan(0)
  })

  it('renders a Copy link button', () => {
    renderRoom()
    expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument()
  })
})

describe('status bar', () => {
  it('shows "Waiting for peer..." when status is waiting', () => {
    renderRoom()
    expect(screen.getByText('Waiting for peer...')).toBeInTheDocument()
  })

  it('shows "Connected" when status is connected', () => {
    useCallSessionMock.mockReturnValue({ ...baseMock, status: 'connected' })
    renderRoom()
    expect(screen.getByText('Connected')).toBeInTheDocument()
  })
})

describe('control bar', () => {
  it('renders all four control buttons', () => {
    renderRoom()
    expect(screen.getByRole('button', { name: /mute/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /disable camera/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /share screen/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hang up/i })).toBeInTheDocument()
  })

  it('calls toggleMic on mic button click', async () => {
    renderRoom()
    await userEvent.click(screen.getByRole('button', { name: /mute/i }))
    expect(baseMock.toggleMic).toHaveBeenCalled()
  })

  it('calls toggleCamera on camera button click', async () => {
    renderRoom()
    await userEvent.click(screen.getByRole('button', { name: /disable camera/i }))
    expect(baseMock.toggleCamera).toHaveBeenCalled()
  })

  it('calls hangup on hang up button click', async () => {
    renderRoom()
    await userEvent.click(screen.getByRole('button', { name: /hang up/i }))
    expect(baseMock.hangup).toHaveBeenCalled()
  })

  it('calls startScreenShare when not sharing', async () => {
    useCallSessionMock.mockReturnValue({ ...baseMock, isScreenSharing: false })
    renderRoom()
    await userEvent.click(screen.getByRole('button', { name: /share screen/i }))
    expect(baseMock.startScreenShare).toHaveBeenCalled()
  })

  it('calls stopScreenShare when sharing', async () => {
    useCallSessionMock.mockReturnValue({ ...baseMock, isScreenSharing: true })
    renderRoom()
    await userEvent.click(screen.getByRole('button', { name: /stop sharing/i }))
    expect(baseMock.stopScreenShare).toHaveBeenCalled()
  })

  it('shows Unmute label when mic is muted', () => {
    useCallSessionMock.mockReturnValue({ ...baseMock, isMicMuted: true })
    renderRoom()
    expect(screen.getByRole('button', { name: /unmute/i })).toBeInTheDocument()
  })

  it('shows Enable camera label when camera is off', () => {
    useCallSessionMock.mockReturnValue({ ...baseMock, isCameraOff: true })
    renderRoom()
    expect(screen.getByRole('button', { name: /enable camera/i })).toBeInTheDocument()
  })
})

describe('error modal', () => {
  it('shows dialog when error is set', () => {
    useCallSessionMock.mockReturnValue({ ...baseMock, error: 'This room is full.' })
    renderRoom()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('This room is full.')).toBeInTheDocument()
  })

  it('does not show dialog when error is null', () => {
    renderRoom()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls dismissError when OK is clicked', async () => {
    useCallSessionMock.mockReturnValue({ ...baseMock, error: 'This room is full.' })
    renderRoom()
    await userEvent.click(screen.getByRole('button', { name: /ok/i }))
    expect(baseMock.dismissError).toHaveBeenCalled()
  })
})
