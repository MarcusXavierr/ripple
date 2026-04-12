// src/hooks/useWebRTC.test.tsx
// Thin hook-wrapper tests — behavioral coverage lives in CallSession.test.ts
import { act, renderHook } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCallStore } from '@/store/call'
import { CallSession } from '@/lib/call/CallSession'
import { useWebRTC } from './useWebRTC'

// ── Mock CallSession ──────────────────────────────────────────────────────────
// vi.mock is hoisted, so mockSession must be defined inside the factory.

vi.mock('@/lib/call/CallSession', () => {
  const mockSession = {
    release: vi.fn(),
    toggleMic: vi.fn(),
    toggleCamera: vi.fn(),
    startScreenShare: vi.fn(),
    stopScreenShare: vi.fn(),
    hangup: vi.fn(),
    dismissError: vi.fn(),
  }
  return {
    CallSession: {
      acquire: vi.fn().mockReturnValue(mockSession),
      __resetForTests: vi.fn(),
    },
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/room/test-room']}>
      <Routes>
        <Route path="/room/:id" element={<>{children}</>} />
      </Routes>
    </MemoryRouter>
  )
}

function renderUseWebRTC(roomId = 'test-room') {
  return renderHook(() => useWebRTC(roomId), { wrapper })
}

// Grab session reference from the mock (acquire always returns same object)
function getSession() {
  return (CallSession.acquire as ReturnType<typeof vi.fn>).mock.results[0]?.value as {
    release: ReturnType<typeof vi.fn>
    toggleMic: ReturnType<typeof vi.fn>
    toggleCamera: ReturnType<typeof vi.fn>
    startScreenShare: ReturnType<typeof vi.fn>
    stopScreenShare: ReturnType<typeof vi.fn>
    hangup: ReturnType<typeof vi.fn>
    dismissError: ReturnType<typeof vi.fn>
  }
}

beforeEach(() => {
  useCallStore.getState().reset()
  vi.clearAllMocks()
  // Restore mockReturnValue after clearAllMocks clears the implementation
  const mockSession = {
    release: vi.fn(),
    toggleMic: vi.fn(),
    toggleCamera: vi.fn(),
    startScreenShare: vi.fn(),
    stopScreenShare: vi.fn(),
    hangup: vi.fn(),
    dismissError: vi.fn(),
  }
  ;(CallSession.acquire as ReturnType<typeof vi.fn>).mockReturnValue(mockSession)
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useWebRTC hook wiring', () => {
  it('acquires a session on mount with the roomId', () => {
    renderUseWebRTC('my-room')
    expect(CallSession.acquire).toHaveBeenCalledWith('my-room', expect.any(Function))
  })

  it('releases the session on unmount', () => {
    const { unmount } = renderUseWebRTC()
    const session = getSession()
    unmount()
    expect(session.release).toHaveBeenCalled()
  })

  it('re-acquires when roomId changes', () => {
    const { rerender } = renderHook(({ roomId }) => useWebRTC(roomId), {
      wrapper,
      initialProps: { roomId: 'room-a' },
    })
    rerender({ roomId: 'room-b' })
    expect(CallSession.acquire).toHaveBeenCalledTimes(2)
    expect(CallSession.acquire).toHaveBeenLastCalledWith('room-b', expect.any(Function))
  })

  it('exposes store values from useCallStore', () => {
    const fakeStream = {} as MediaStream
    useCallStore.setState({
      localStream: fakeStream,
      status: 'connected',
      error: null,
      isScreenSharing: true,
      isMicMuted: true,
      isCameraOff: false,
    })
    const { result } = renderUseWebRTC()
    expect(result.current.localStream).toBe(fakeStream)
    expect(result.current.status).toBe('connected')
    expect(result.current.isScreenSharing).toBe(true)
    expect(result.current.isMicMuted).toBe(true)
    expect(result.current.isCameraOff).toBe(false)
  })

  it('forwards toggleMic to the session', () => {
    const { result } = renderUseWebRTC()
    const session = getSession()
    act(() => result.current.toggleMic())
    expect(session.toggleMic).toHaveBeenCalled()
  })

  it('forwards toggleCamera to the session', () => {
    const { result } = renderUseWebRTC()
    const session = getSession()
    act(() => result.current.toggleCamera())
    expect(session.toggleCamera).toHaveBeenCalled()
  })

  it('forwards startScreenShare to the session', () => {
    const { result } = renderUseWebRTC()
    const session = getSession()
    act(() => { result.current.startScreenShare() })
    expect(session.startScreenShare).toHaveBeenCalled()
  })

  it('forwards stopScreenShare to the session', () => {
    const { result } = renderUseWebRTC()
    const session = getSession()
    act(() => { result.current.stopScreenShare() })
    expect(session.stopScreenShare).toHaveBeenCalled()
  })

  it('forwards hangup to the session', () => {
    const { result } = renderUseWebRTC()
    const session = getSession()
    act(() => result.current.hangup())
    expect(session.hangup).toHaveBeenCalled()
  })

  it('forwards dismissError to the session', () => {
    const { result } = renderUseWebRTC()
    const session = getSession()
    act(() => result.current.dismissError())
    expect(session.dismissError).toHaveBeenCalled()
  })
})
