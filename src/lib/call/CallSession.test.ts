// src/lib/call/CallSession.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCallStore } from '@/store/call'
import { CLOSE_CODES } from '@/types/signaling'
import { CallSession } from './CallSession'
import {
  MockRTCPeerConnection,
  MockWebSocket,
  installGlobalMocks,
  mockAudioTrack,
  mockScreenTrack,
  mockStream,
  mockVideoTrack,
  resetMocks,
} from './__tests__/mocks'

installGlobalMocks()

const ROOM = 'test-room'
const mockNavigate = vi.fn()

function acquire(roomId = ROOM) {
  return CallSession.acquire(roomId, mockNavigate)
}

/** Drain all pending microtasks (safe under vi.useFakeTimers). */
async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

/** Send a server message to the latest WS. */
function send(data: unknown, ws = MockWebSocket.lastInstance!) {
  ws.receive(data)
}

beforeEach(() => {
  CallSession.__resetForTests()
  useCallStore.getState().reset()
  mockNavigate.mockClear()
  resetMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

// ── Lifecycle / StrictMode safety ─────────────────────────────────────────────

describe('lifecycle', () => {
  it('creates exactly one WS and PC even under StrictMode double-mount/unmount/mount', async () => {
    vi.useFakeTimers()

    const s1 = acquire()
    await flush()            // let getUserMedia resolve
    s1.release()             // count → 0, schedules teardown via setTimeout(0)
    const s2 = acquire()     // count → 1 again, cancels scheduled teardown

    vi.runAllTimers()        // fire any remaining timers — teardown should NOT have fired
    await flush()

    expect(MockWebSocket.instances).toHaveLength(1)
    s2.release()
    vi.runAllTimers()
  })

  it('returns the same session for two concurrent acquires on the same roomId', () => {
    const s1 = acquire()
    const s2 = acquire()
    expect(s1).toBe(s2)
    s1.release()
    s2.release()
  })

  it('returns independent sessions for different roomIds', () => {
    const s1 = acquire('room-a')
    const s2 = acquire('room-b')
    expect(s1).not.toBe(s2)
    s1.release()
    s2.release()
  })

  it('tears down WS and PC when refcount reaches zero and timer fires', async () => {
    vi.useFakeTimers()
    const s = acquire()
    await flush()           // settle getUserMedia → connectWS
    s.release()
    vi.runAllTimers()       // fire the deferred teardown
    expect(MockWebSocket.lastInstance!.close).toHaveBeenCalledWith(1000, 'unmount')
  })

  it('stops media tracks on teardown', async () => {
    vi.useFakeTimers()
    const s = acquire()
    await flush()           // settle getUserMedia (which already sets localStream)
    s.release()
    vi.runAllTimers()       // fire deferred teardown
    expect(mockAudioTrack.stop).toHaveBeenCalled()
    expect(mockVideoTrack.stop).toHaveBeenCalled()
  })
})

// ── Media acquisition ─────────────────────────────────────────────────────────

describe('media acquisition', () => {
  it('calls getUserMedia on start', async () => {
    acquire()
    await flush()
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ video: true, audio: true })
  })

  it('stores localStream in the store after getUserMedia resolves', async () => {
    acquire()
    await flush()
    expect(useCallStore.getState().localStream).toBe(mockStream)
  })

  it('sets error when getUserMedia is denied', async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(new Error('denied'))
    acquire()
    await flush()
    expect(useCallStore.getState().error).toBe(
      'Camera and microphone access is required to join a call.',
    )
  })

  it('stops acquired stream tracks if session was released before getUserMedia resolved', async () => {
    vi.useFakeTimers()
    let resolveGUM!: (s: MediaStream) => void
    ;(navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      new Promise<MediaStream>((r) => { resolveGUM = r }),
    )
    const s = acquire()
    s.release()
    vi.runAllTimers() // fire deferred teardown — session removed from registry

    // GUM promise resolves AFTER teardown
    resolveGUM(mockStream as unknown as MediaStream)
    await flush()

    // Tracks must be stopped, WS must NOT have been opened
    expect(mockAudioTrack.stop).toHaveBeenCalled()
    expect(mockVideoTrack.stop).toHaveBeenCalled()
    expect(MockWebSocket.instances).toHaveLength(0)
  })
})

// ── WebSocket connection ──────────────────────────────────────────────────────

describe('WebSocket', () => {
  it('creates WS with room and peerId query params', async () => {
    acquire('coral-tiger-42')
    await flush()
    expect(MockWebSocket.lastInstance!.url).toMatch(/room=coral-tiger-42/)
    expect(MockWebSocket.lastInstance!.url).toMatch(/peerId=/)
  })

  it('sets status to connecting immediately after WS is created', async () => {
    acquire()
    await flush()
    expect(useCallStore.getState().status).toBe('connecting')
  })

  it('sends pong when ping is received', async () => {
    acquire()
    await flush()
    send({ type: 'ping' })
    expect(MockWebSocket.lastInstance!.send).toHaveBeenCalledWith(JSON.stringify({ type: 'pong' }))
  })

  it('does not send when WS readyState is not OPEN', async () => {
    acquire()
    await flush()
    MockWebSocket.lastInstance!.readyState = WebSocket.CONNECTING
    send({ type: 'ping' })
    expect(MockWebSocket.lastInstance!.send).not.toHaveBeenCalled()
  })

  it('ignores unknown message types without throwing', async () => {
    acquire()
    await flush()
    expect(() => send({ type: 'unknown-future-event' })).not.toThrow()
  })
})

// ── Close codes ───────────────────────────────────────────────────────────────

describe('WS close codes', () => {
  it('sets error on ROOM_FULL (4001)', async () => {
    acquire()
    await flush()
    MockWebSocket.lastInstance!.simulateClose(CLOSE_CODES.ROOM_FULL)
    expect(useCallStore.getState().error).toMatch(/room is full/i)
  })

  it('navigates to /ended on PEER_DISCONNECTED (4002)', async () => {
    acquire(ROOM)
    await flush()
    MockWebSocket.lastInstance!.simulateClose(CLOSE_CODES.PEER_DISCONNECTED)
    expect(mockNavigate).toHaveBeenCalledWith(`/room/${ROOM}/ended`)
  })

  it("sets error on ROOM_NOT_FOUND (4003)", async () => {
    acquire()
    await flush()
    MockWebSocket.lastInstance!.simulateClose(CLOSE_CODES.ROOM_NOT_FOUND)
    expect(useCallStore.getState().error).toMatch(/doesn't exist/i)
  })

  it('sets error on DUPLICATE_SESSION (4004)', async () => {
    acquire()
    await flush()
    MockWebSocket.lastInstance!.simulateClose(CLOSE_CODES.DUPLICATE_SESSION)
    expect(useCallStore.getState().error).toMatch(/another tab/i)
  })

  it('does not reconnect or error on clean close (1000)', async () => {
    acquire()
    await flush()
    const ws = MockWebSocket.lastInstance!
    ws.simulateClose(1000)
    expect(useCallStore.getState().error).toBeNull()
    expect(MockWebSocket.instances).toHaveLength(1)
  })
})

// ── Reconnection ──────────────────────────────────────────────────────────────

describe('reconnection', () => {
  it('schedules a reconnect and sets status=reconnecting on non-enumerated close code', async () => {
    vi.useFakeTimers()
    acquire()
    await flush()                                    // settle getUserMedia
    MockWebSocket.lastInstance!.simulateClose(1006)
    expect(useCallStore.getState().status).toBe('reconnecting')
    vi.runAllTimers()                                // fire reconnect timer → connectWS
    expect(MockWebSocket.instances).toHaveLength(2)
  })

  it('sets "Unable to connect" error after MAX_WS_ATTEMPTS failures', async () => {
    vi.useFakeTimers()
    acquire()
    await flush()
    // MAX_WS_ATTEMPTS = 3: need 3 failures (wsAttempts++ inside each, error on 3rd)
    for (let i = 0; i < 3; i++) {
      MockWebSocket.lastInstance!.simulateClose(1006)
      vi.runAllTimers()
    }
    expect(useCallStore.getState().error).toMatch(/unable to connect/i)
  })

  it('doubles the reconnect delay on successive failures', async () => {
    vi.useFakeTimers()
    const spy = vi.spyOn(globalThis, 'setTimeout')
    acquire()
    await flush()

    MockWebSocket.lastInstance!.simulateClose(1006)
    const delay1 = spy.mock.calls[spy.mock.calls.length - 1]?.[1] as number

    vi.runAllTimers()

    MockWebSocket.lastInstance!.simulateClose(1006)
    const delay2 = spy.mock.calls[spy.mock.calls.length - 1]?.[1] as number

    expect(delay2).toBe(delay1 * 2)
    vi.runAllTimers()
  })

  it('handles onopen with reconnect:true without creating a duplicate PC', async () => {
    acquire()
    await flush()
    send({ type: 'onopen', role: 'caller', reconnect: true })
    expect(MockRTCPeerConnection.instances).toHaveLength(1)
  })
})

// ── PC setup (onopen) ─────────────────────────────────────────────────────────

describe('onopen message', () => {
  it('sets status to waiting', async () => {
    acquire()
    await flush()
    send({ type: 'onopen', role: 'caller', reconnect: false })
    expect(useCallStore.getState().status).toBe('waiting')
  })

  it('stores the role from onopen', async () => {
    acquire()
    await flush()
    send({ type: 'onopen', role: 'callee', reconnect: false })
    expect(useCallStore.getState().role).toBe('callee')
  })

  it('creates an RTCPeerConnection', async () => {
    acquire()
    await flush()
    send({ type: 'onopen', role: 'caller', reconnect: false })
    expect(MockRTCPeerConnection.lastInstance).not.toBeNull()
  })

  it('adds both audio and video tracks to the PC', async () => {
    acquire()
    await flush()
    send({ type: 'onopen', role: 'caller', reconnect: false })
    expect(MockRTCPeerConnection.lastInstance!.addTrack).toHaveBeenCalledTimes(2)
  })
})

// ── enter message ─────────────────────────────────────────────────────────────

describe('enter message', () => {
  it('sets status to negotiating', async () => {
    acquire()
    await flush()
    send({ type: 'onopen', role: 'caller', reconnect: false })
    send({ type: 'enter' })
    expect(useCallStore.getState().status).toBe('negotiating')
  })

  it('calls restartIce when role is caller', async () => {
    acquire()
    await flush()
    send({ type: 'onopen', role: 'caller', reconnect: false })
    send({ type: 'enter' })
    await flush()
    expect(MockRTCPeerConnection.lastInstance!.restartIce).toHaveBeenCalled()
  })

  it('rolls back local description before restartIce when in have-local-offer state', async () => {
    acquire()
    await flush()
    send({ type: 'onopen', role: 'caller', reconnect: false })
    MockRTCPeerConnection.lastInstance!.signalingState = 'have-local-offer'
    send({ type: 'enter' })
    await flush()
    expect(MockRTCPeerConnection.lastInstance!.setLocalDescription).toHaveBeenCalledWith({ type: 'rollback' })
    expect(MockRTCPeerConnection.lastInstance!.restartIce).toHaveBeenCalled()
  })

  it('does not call restartIce when role is callee', async () => {
    acquire()
    await flush()
    send({ type: 'onopen', role: 'callee', reconnect: false })
    send({ type: 'enter' })
    await flush()
    expect(MockRTCPeerConnection.lastInstance!.restartIce).not.toHaveBeenCalled()
  })
})

// ── peer-reconnected ──────────────────────────────────────────────────────────

describe('peer-reconnected message', () => {
  it('caller calls restartIce and sets status=negotiating', async () => {
    acquire()
    await flush()
    send({ type: 'onopen', role: 'caller', reconnect: false })
    send({ type: 'peer-reconnected' })
    await flush()
    expect(useCallStore.getState().status).toBe('negotiating')
    expect(MockRTCPeerConnection.lastInstance!.restartIce).toHaveBeenCalled()
  })

  it('callee does not call restartIce', async () => {
    acquire()
    await flush()
    send({ type: 'onopen', role: 'callee', reconnect: false })
    send({ type: 'peer-reconnected' })
    await flush()
    expect(MockRTCPeerConnection.lastInstance!.restartIce).not.toHaveBeenCalled()
  })
})

// ── Offer / answer flow ───────────────────────────────────────────────────────

describe('callee offer/answer flow', () => {
  async function setupCallee() {
    acquire()
    await flush()
    send({ type: 'onopen', role: 'callee', reconnect: false })
  }

  it('calls setRemoteDescription with the offer', async () => {
    await setupCallee()
    send({ type: 'offer', offer: { type: 'offer', sdp: 'remote-sdp' } })
    await flush()
    expect(MockRTCPeerConnection.lastInstance!.setRemoteDescription).toHaveBeenCalledWith({
      type: 'offer', sdp: 'remote-sdp',
    })
  })

  it('sends an answer after receiving an offer', async () => {
    await setupCallee()
    send({ type: 'offer', offer: { type: 'offer', sdp: 'remote-sdp' } })
    await flush()
    const calls = MockWebSocket.lastInstance!.send.mock.calls as string[][]
    expect(calls.some((c) => c[0].includes('"type":"answer"'))).toBe(true)
  })
})

describe('caller answer flow', () => {
  it('calls setRemoteDescription with the answer', async () => {
    acquire()
    await flush()
    send({ type: 'onopen', role: 'caller', reconnect: false })
    send({ type: 'answer', answer: { type: 'answer', sdp: 'answer-sdp' } })
    await flush()
    expect(MockRTCPeerConnection.lastInstance!.setRemoteDescription).toHaveBeenCalledWith({
      type: 'answer', sdp: 'answer-sdp',
    })
  })

  it('drains queued ICE candidates after receiving answer', async () => {
    acquire()
    await flush()
    send({ type: 'onopen', role: 'caller', reconnect: false })
    send({ type: 'ice-candidate', candidate: { candidate: 'c1', sdpMid: '0', sdpMLineIndex: 0 } })
    send({ type: 'answer', answer: { type: 'answer', sdp: 'answer-sdp' } })
    await flush()
    expect(MockRTCPeerConnection.lastInstance!.addIceCandidate).toHaveBeenCalledWith({
      candidate: 'c1', sdpMid: '0', sdpMLineIndex: 0,
    })
  })
})

// ── Perfect negotiation ───────────────────────────────────────────────────────

describe('perfect negotiation (impolite = caller)', () => {
  it('impolite peer ignores offer when makingOffer', async () => {
    acquire()
    await flush()
    send({ type: 'onopen', role: 'caller', reconnect: false })
    const pc = MockRTCPeerConnection.lastInstance!
    // Trigger onnegotiationneeded to set makingOffer = true mid-flight
    // Simulate by setting signalingState to 'have-local-offer'
    pc.signalingState = 'have-local-offer'
    send({ type: 'offer', offer: { type: 'offer', sdp: 'sdp' } })
    await flush()
    // setRemoteDescription should NOT have been called
    expect(pc.setRemoteDescription).not.toHaveBeenCalled()
  })

  it('polite peer (callee) accepts offer even in collision', async () => {
    acquire()
    await flush()
    send({ type: 'onopen', role: 'callee', reconnect: false })
    const pc = MockRTCPeerConnection.lastInstance!
    pc.signalingState = 'have-local-offer'
    send({ type: 'offer', offer: { type: 'offer', sdp: 'sdp' } })
    await flush()
    expect(pc.setRemoteDescription).toHaveBeenCalled()
  })
})

// ── ICE candidate queuing ─────────────────────────────────────────────────────

describe('ICE candidate queuing', () => {
  it('queues candidates that arrive before remote description is set', async () => {
    acquire()
    await flush()
    send({ type: 'onopen', role: 'callee', reconnect: false })
    send({ type: 'ice-candidate', candidate: { candidate: 'c1', sdpMid: '0', sdpMLineIndex: 0 } })
    expect(MockRTCPeerConnection.lastInstance!.addIceCandidate).not.toHaveBeenCalled()
  })

  it('drains queued candidates after setRemoteDescription via offer', async () => {
    acquire()
    await flush()
    send({ type: 'onopen', role: 'callee', reconnect: false })
    send({ type: 'ice-candidate', candidate: { candidate: 'c1', sdpMid: '0', sdpMLineIndex: 0 } })
    send({ type: 'offer', offer: { type: 'offer', sdp: 'remote' } })
    await flush()
    expect(MockRTCPeerConnection.lastInstance!.addIceCandidate).toHaveBeenCalledWith({
      candidate: 'c1', sdpMid: '0', sdpMLineIndex: 0,
    })
  })
})

// ── PC event wiring ───────────────────────────────────────────────────────────

describe('PC event wiring', () => {
  it('sends ice-candidate message when pc.onicecandidate fires with a candidate', async () => {
    acquire()
    await flush()
    send({ type: 'onopen', role: 'caller', reconnect: false })
    const pc = MockRTCPeerConnection.lastInstance!
    const candidate = { toJSON: () => ({ candidate: 'c', sdpMid: '0', sdpMLineIndex: 0 }) }
    pc.onicecandidate!({ candidate } as unknown as RTCPeerConnectionIceEvent)
    expect(MockWebSocket.lastInstance!.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'ice-candidate', candidate: candidate.toJSON() }),
    )
  })

  it('does not send when pc.onicecandidate fires with null candidate', async () => {
    acquire()
    await flush()
    send({ type: 'onopen', role: 'caller', reconnect: false })
    const ws = MockWebSocket.lastInstance!
    ws.send.mockClear()
    MockRTCPeerConnection.lastInstance!.onicecandidate!({ candidate: null } as RTCPeerConnectionIceEvent)
    expect(ws.send).not.toHaveBeenCalled()
  })

  it('sets remoteStream in store when pc.ontrack fires', async () => {
    acquire()
    await flush()
    send({ type: 'onopen', role: 'caller', reconnect: false })
    const fakeStream = { id: 'remote' }
    MockRTCPeerConnection.lastInstance!.ontrack!({ streams: [fakeStream] } as unknown as RTCTrackEvent)
    expect(useCallStore.getState().remoteStream).toBe(fakeStream)
  })

  it('sends an offer when pc.onnegotiationneeded fires', async () => {
    acquire()
    await flush()
    send({ type: 'onopen', role: 'caller', reconnect: false })
    const ws = MockWebSocket.lastInstance!
    ws.send.mockClear()
    await MockRTCPeerConnection.lastInstance!.onnegotiationneeded!()
    expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"type":"offer"'))
  })
})

// ── ICE connection state ──────────────────────────────────────────────────────

describe('ICE connection state changes', () => {
  async function setupCaller() {
    acquire()
    await flush()
    send({ type: 'onopen', role: 'caller', reconnect: false })
  }

  it('sets status to connected when ICE state is connected', async () => {
    await setupCaller()
    const pc = MockRTCPeerConnection.lastInstance!
    pc.iceConnectionState = 'connected'
    pc.oniceconnectionstatechange!()
    expect(useCallStore.getState().status).toBe('connected')
  })

  it('sets status to connected when ICE state is completed', async () => {
    await setupCaller()
    const pc = MockRTCPeerConnection.lastInstance!
    pc.iceConnectionState = 'completed'
    pc.oniceconnectionstatechange!()
    expect(useCallStore.getState().status).toBe('connected')
  })

  it('calls restartIce when ICE fails and role is caller', async () => {
    await setupCaller()
    const pc = MockRTCPeerConnection.lastInstance!
    pc.iceConnectionState = 'failed'
    pc.oniceconnectionstatechange!()
    expect(pc.restartIce).toHaveBeenCalled()
  })

  it('does not call restartIce when ICE fails and role is callee', async () => {
    acquire()
    await flush()
    send({ type: 'onopen', role: 'callee', reconnect: false })
    const pc = MockRTCPeerConnection.lastInstance!
    pc.iceConnectionState = 'failed'
    pc.oniceconnectionstatechange!()
    expect(pc.restartIce).not.toHaveBeenCalled()
  })
})


// ── Hangup ────────────────────────────────────────────────────────────────────

describe('hangup', () => {
  it('closes WS with code 1000', async () => {
    const s = acquire()
    await flush()
    s.hangup()
    expect(MockWebSocket.lastInstance!.close).toHaveBeenCalledWith(1000, 'hangup')
  })

  it('navigates to /ended', async () => {
    const s = acquire(ROOM)
    await flush()
    s.hangup()
    expect(mockNavigate).toHaveBeenCalledWith(`/room/${ROOM}/ended`)
  })

  it('stops media tracks', async () => {
    const s = acquire()
    await flush()
    s.hangup()
    expect(mockAudioTrack.stop).toHaveBeenCalled()
    expect(mockVideoTrack.stop).toHaveBeenCalled()
  })

  it('closes the PeerConnection', async () => {
    const s = acquire()
    await flush()
    send({ type: 'onopen', role: 'caller', reconnect: false })
    s.hangup()
    expect(MockRTCPeerConnection.lastInstance!.close).toHaveBeenCalled()
  })
})

// ── dismissError ──────────────────────────────────────────────────────────────

describe('dismissError', () => {
  it('clears the error', async () => {
    const s = acquire()
    useCallStore.setState({ error: 'Some error' })
    s.dismissError()
    expect(useCallStore.getState().error).toBeNull()
  })

  it('navigates to / for room-full error', async () => {
    const s = acquire()
    useCallStore.setState({ error: 'This room is full. Only two participants are allowed.' })
    s.dismissError()
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it("navigates to / for room-not-found error", async () => {
    const s = acquire()
    useCallStore.setState({ error: "This room doesn't exist." })
    s.dismissError()
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('navigates to / for duplicate-session error', async () => {
    const s = acquire()
    useCallStore.setState({ error: "You're connected to this room from another tab." })
    s.dismissError()
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('navigates to / for unable-to-connect error', async () => {
    const s = acquire()
    useCallStore.setState({ error: 'Unable to connect to the server.' })
    s.dismissError()
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('does not navigate for media-denied error', async () => {
    const s = acquire()
    useCallStore.setState({ error: 'Camera and microphone access is required to join a call.' })
    s.dismissError()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})


// ── Store coherence ───────────────────────────────────────────────────────────

describe('store coherence', () => {
  it('reset() clears isMicMuted and isCameraOff', async () => {
    useCallStore.setState({ isMicMuted: true, isCameraOff: true })
    useCallStore.getState().reset()
    expect(useCallStore.getState().isMicMuted).toBe(false)
    expect(useCallStore.getState().isCameraOff).toBe(false)
  })
})
