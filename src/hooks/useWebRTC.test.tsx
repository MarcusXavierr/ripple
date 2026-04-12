// src/hooks/useWebRTC.test.ts
import { act, renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useCallStore } from '@/store/call'
import { CLOSE_CODES } from '@/types/signaling'
import { useWebRTC } from './useWebRTC'

// ── WebSocket mock ────────────────────────────────────────────────────────────

class MockWebSocket {
  static lastInstance: MockWebSocket | null = null
  url: string
  onopen: ((e: Event) => void) | null = null
  onclose: ((e: CloseEvent) => void) | null = null
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: Event) => void) | null = null
  send = vi.fn()
  close = vi.fn()
  readyState = WebSocket.OPEN

  constructor(url: string) {
    this.url = url
    MockWebSocket.lastInstance = this
  }
}

vi.stubGlobal('WebSocket', MockWebSocket)

// ── RTCPeerConnection mock ────────────────────────────────────────────────────

class MockRTCPeerConnection {
  static lastInstance: MockRTCPeerConnection | null = null
  localDescription: RTCSessionDescriptionInit | null = null
  iceConnectionState = 'new'
  connectionState = 'new'
  signalingState = 'stable'
  onicecandidate: ((e: RTCPeerConnectionIceEvent) => void) | null = null
  ontrack: ((e: RTCTrackEvent) => void) | null = null
  oniceconnectionstatechange: (() => void) | null = null
  onnegotiationneeded: (() => void) | null = null
  addTrack = vi.fn()
  getSenders = vi.fn().mockReturnValue([])
  setLocalDescription = vi.fn().mockImplementation(async () => {
    this.localDescription = { type: 'offer', sdp: 'mock-sdp' }
  })
  setRemoteDescription = vi.fn().mockResolvedValue(undefined)
  addIceCandidate = vi.fn().mockResolvedValue(undefined)
  restartIce = vi.fn()
  close = vi.fn()

  constructor() {
    MockRTCPeerConnection.lastInstance = this
  }
}

vi.stubGlobal('RTCPeerConnection', MockRTCPeerConnection)

// ── Media mock ────────────────────────────────────────────────────────────────

export const mockAudioTrack = { kind: 'audio', enabled: true, stop: vi.fn() }
export const mockVideoTrack = { kind: 'video', enabled: true, stop: vi.fn(), onended: null as (() => void) | null }
export const mockStream = {
  getTracks: vi.fn().mockReturnValue([mockAudioTrack, mockVideoTrack]),
  getAudioTracks: vi.fn().mockReturnValue([mockAudioTrack]),
  getVideoTracks: vi.fn().mockReturnValue([mockVideoTrack]),
}

Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue(mockStream),
    getDisplayMedia: vi.fn(),
  },
  writable: true,
})

// ── Navigation mock ───────────────────────────────────────────────────────────

export const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/room/test-room-01']}>
      <Routes>
        <Route path="/room/:id" element={<>{children}</>} />
      </Routes>
    </MemoryRouter>
  )
}

function renderUseWebRTC(roomId = 'test-room-01') {
  return renderHook(() => useWebRTC(roomId), { wrapper })
}

function sendToHook(data: unknown) {
  MockWebSocket.lastInstance!.onmessage!(
    new MessageEvent('message', { data: JSON.stringify(data) }),
  )
}

function closeWS(code: number) {
  MockWebSocket.lastInstance!.onclose!(
    new CloseEvent('close', { code, wasClean: false }),
  )
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  useCallStore.getState().reset()
  mockNavigate.mockClear()
  MockWebSocket.lastInstance = null
  MockRTCPeerConnection.lastInstance = null
  mockAudioTrack.enabled = true
  mockVideoTrack.enabled = true
  vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
    mockStream as unknown as MediaStream,
  )
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('media acquisition', () => {
  it('calls getUserMedia on mount', async () => {
    renderUseWebRTC()
    await waitFor(() =>
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: true,
        audio: true,
      }),
    )
  })

  it('sets localStream in store after getUserMedia resolves', async () => {
    renderUseWebRTC()
    await waitFor(() => expect(useCallStore.getState().localStream).toBe(mockStream))
  })

  it('sets error when getUserMedia is denied', async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(new Error('denied'))
    renderUseWebRTC()
    await waitFor(() =>
      expect(useCallStore.getState().error).toBe(
        'Camera and microphone access is required to join a call.',
      ),
    )
  })
})

describe('WebSocket connection', () => {
  it('creates WebSocket with room and peerId query params', async () => {
    renderUseWebRTC('coral-tiger-42')
    await waitFor(() => expect(MockWebSocket.lastInstance).not.toBeNull())
    expect(MockWebSocket.lastInstance!.url).toMatch(/room=coral-tiger-42/)
    expect(MockWebSocket.lastInstance!.url).toMatch(/peerId=/)
  })

  it('sets status to connecting immediately after WS created', async () => {
    renderUseWebRTC()
    await waitFor(() => expect(useCallStore.getState().status).toBe('connecting'))
  })
})

describe('onopen message', () => {
  it('sets status to waiting for caller', async () => {
    renderUseWebRTC()
    await waitFor(() => expect(MockWebSocket.lastInstance).not.toBeNull())
    act(() => sendToHook({ type: 'onopen', role: 'caller', reconnect: false }))
    await waitFor(() => expect(useCallStore.getState().status).toBe('waiting'))
  })

  it('sets status to waiting for callee', async () => {
    renderUseWebRTC()
    await waitFor(() => expect(MockWebSocket.lastInstance).not.toBeNull())
    act(() => sendToHook({ type: 'onopen', role: 'callee', reconnect: false }))
    await waitFor(() => expect(useCallStore.getState().status).toBe('waiting'))
  })

  it('stores the role from onopen', async () => {
    renderUseWebRTC()
    await waitFor(() => expect(MockWebSocket.lastInstance).not.toBeNull())
    act(() => sendToHook({ type: 'onopen', role: 'caller', reconnect: false }))
    await waitFor(() => expect(useCallStore.getState().role).toBe('caller'))
  })
})

describe('ping/pong', () => {
  it('sends pong when ping received', async () => {
    renderUseWebRTC()
    await waitFor(() => expect(MockWebSocket.lastInstance).not.toBeNull())
    act(() => sendToHook({ type: 'ping' }))
    expect(MockWebSocket.lastInstance!.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'pong' }),
    )
  })
})

describe('WebSocket close codes', () => {
  async function setup() {
    renderUseWebRTC()
    await waitFor(() => expect(MockWebSocket.lastInstance).not.toBeNull())
  }

  it('sets error on ROOM_FULL (4001)', async () => {
    await setup()
    act(() => closeWS(CLOSE_CODES.ROOM_FULL))
    expect(useCallStore.getState().error).toMatch(/room is full/i)
  })

  it('navigates to /ended on PEER_DISCONNECTED (4002)', async () => {
    renderUseWebRTC('test-room-01')
    await waitFor(() => expect(MockWebSocket.lastInstance).not.toBeNull())
    act(() => closeWS(CLOSE_CODES.PEER_DISCONNECTED))
    expect(mockNavigate).toHaveBeenCalledWith('/room/test-room-01/ended')
  })

  it("sets error on ROOM_NOT_FOUND (4003)", async () => {
    await setup()
    act(() => closeWS(CLOSE_CODES.ROOM_NOT_FOUND))
    expect(useCallStore.getState().error).toMatch(/doesn't exist/i)
  })

  it('sets error on DUPLICATE_SESSION (4004)', async () => {
    await setup()
    act(() => closeWS(CLOSE_CODES.DUPLICATE_SESSION))
    expect(useCallStore.getState().error).toMatch(/another tab/i)
  })

  it('does not reconnect or error on clean close (1000)', async () => {
    await setup()
    const firstWs = MockWebSocket.lastInstance
    act(() => {
      MockWebSocket.lastInstance!.onclose!(
        new CloseEvent('close', { code: 1000, wasClean: true }),
      )
    })
    expect(MockWebSocket.lastInstance).toBe(firstWs)
    expect(useCallStore.getState().error).toBeNull()
  })
})

describe('RTCPeerConnection setup', () => {
  it('creates RTCPeerConnection after receiving onopen', async () => {
    renderUseWebRTC()
    await waitFor(() => expect(MockWebSocket.lastInstance).not.toBeNull())
    act(() => sendToHook({ type: 'onopen', role: 'caller', reconnect: false }))
    await waitFor(() => expect(MockRTCPeerConnection.lastInstance).not.toBeNull())
  })

  it('adds local stream tracks to the PeerConnection', async () => {
    renderUseWebRTC()
    await waitFor(() => expect(MockWebSocket.lastInstance).not.toBeNull())
    act(() => sendToHook({ type: 'onopen', role: 'caller', reconnect: false }))
    await waitFor(() => expect(MockRTCPeerConnection.lastInstance).not.toBeNull())
    // audio + video track = 2 calls
    expect(MockRTCPeerConnection.lastInstance!.addTrack).toHaveBeenCalledTimes(2)
  })
})

describe('ICE candidate queuing', () => {
  it('queues candidates that arrive before remote description is set', async () => {
    renderUseWebRTC()
    await waitFor(() => expect(MockWebSocket.lastInstance).not.toBeNull())
    act(() => sendToHook({ type: 'onopen', role: 'callee', reconnect: false }))
    await waitFor(() => expect(MockRTCPeerConnection.lastInstance).not.toBeNull())

    act(() =>
      sendToHook({
        type: 'ice-candidate',
        candidate: { candidate: 'c1', sdpMid: '0', sdpMLineIndex: 0 },
      }),
    )
    // No remote desc set yet
    expect(MockRTCPeerConnection.lastInstance!.addIceCandidate).not.toHaveBeenCalled()
  })

  it('drains queued candidates after setRemoteDescription (via offer)', async () => {
    renderUseWebRTC()
    await waitFor(() => expect(MockWebSocket.lastInstance).not.toBeNull())
    act(() => sendToHook({ type: 'onopen', role: 'callee', reconnect: false }))
    await waitFor(() => expect(MockRTCPeerConnection.lastInstance).not.toBeNull())

    act(() =>
      sendToHook({
        type: 'ice-candidate',
        candidate: { candidate: 'c1', sdpMid: '0', sdpMLineIndex: 0 },
      }),
    )
    await act(async () => {
      sendToHook({ type: 'offer', offer: { type: 'offer', sdp: 'remote' } })
    })
    await waitFor(() =>
      expect(MockRTCPeerConnection.lastInstance!.addIceCandidate).toHaveBeenCalledWith({
        candidate: 'c1',
        sdpMid: '0',
        sdpMLineIndex: 0,
      }),
    )
  })
})

describe('offer/answer flow (callee)', () => {
  async function setupCallee() {
    renderUseWebRTC()
    await waitFor(() => expect(MockWebSocket.lastInstance).not.toBeNull())
    act(() => sendToHook({ type: 'onopen', role: 'callee', reconnect: false }))
    await waitFor(() => expect(MockRTCPeerConnection.lastInstance).not.toBeNull())
  }

  it('calls setRemoteDescription with the offer', async () => {
    await setupCallee()
    await act(async () => {
      sendToHook({ type: 'offer', offer: { type: 'offer', sdp: 'remote-sdp' } })
    })
    await waitFor(() =>
      expect(MockRTCPeerConnection.lastInstance!.setRemoteDescription).toHaveBeenCalledWith({
        type: 'offer',
        sdp: 'remote-sdp',
      }),
    )
  })

  it('sends an answer after receiving offer', async () => {
    await setupCallee()
    await act(async () => {
      sendToHook({ type: 'offer', offer: { type: 'offer', sdp: 'remote-sdp' } })
    })
    await waitFor(() => {
      const calls = MockWebSocket.lastInstance!.send.mock.calls as string[][]
      const answerCall = calls.find((c) => c[0].includes('"type":"answer"'))
      expect(answerCall).toBeTruthy()
    })
  })
})

describe('ICE connection state changes', () => {
  async function setupCaller() {
    renderUseWebRTC()
    await waitFor(() => expect(MockWebSocket.lastInstance).not.toBeNull())
    act(() => sendToHook({ type: 'onopen', role: 'caller', reconnect: false }))
    await waitFor(() => expect(MockRTCPeerConnection.lastInstance).not.toBeNull())
  }

  it('sets status to connected when ICE state is connected', async () => {
    await setupCaller()
    act(() => {
      MockRTCPeerConnection.lastInstance!.iceConnectionState = 'connected'
      MockRTCPeerConnection.lastInstance!.oniceconnectionstatechange!()
    })
    expect(useCallStore.getState().status).toBe('connected')
  })

  it('calls restartIce when ICE fails and role is caller', async () => {
    await setupCaller()
    act(() => {
      MockRTCPeerConnection.lastInstance!.iceConnectionState = 'failed'
      MockRTCPeerConnection.lastInstance!.oniceconnectionstatechange!()
    })
    expect(MockRTCPeerConnection.lastInstance!.restartIce).toHaveBeenCalled()
  })
})
