// src/lib/call/__tests__/mocks.ts
// Shared mocks for CallSession and useWebRTC tests

// ── WebSocket mock ────────────────────────────────────────────────────────────

export class MockWebSocket {
  // Real WebSocket constants needed for readyState comparisons in production code
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  static instances: MockWebSocket[] = []
  static get lastInstance(): MockWebSocket | null {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1] ?? null
  }

  url: string
  readyState = MockWebSocket.OPEN
  onopen: ((e: Event) => void) | null = null
  onclose: ((e: CloseEvent) => void) | null = null
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: Event) => void) | null = null
  send = vi.fn()
  close = vi.fn()

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  /** Simulate a server message arriving on this WS. */
  receive(data: unknown) {
    this.onmessage!(new MessageEvent("message", { data: JSON.stringify(data) }))
  }

  /** Simulate the WS closing. */
  simulateClose(code: number) {
    this.onclose!(new CloseEvent("close", { code, wasClean: code === 1000 }))
  }
}

// ── RTCPeerConnection mock ────────────────────────────────────────────────────

export class MockRTCPeerConnection {
  static instances: MockRTCPeerConnection[] = []
  static get lastInstance(): MockRTCPeerConnection | null {
    return MockRTCPeerConnection.instances[MockRTCPeerConnection.instances.length - 1] ?? null
  }

  localDescription: RTCSessionDescriptionInit | null = null
  iceConnectionState = "new"
  signalingState = "stable"
  onicecandidate: ((e: RTCPeerConnectionIceEvent) => void) | null = null
  ontrack: ((e: RTCTrackEvent) => void) | null = null
  oniceconnectionstatechange: (() => void) | null = null
  onnegotiationneeded: (() => Promise<void>) | null = null

  addTrack = vi.fn()
  getSenders = vi.fn().mockReturnValue([])
  setLocalDescription = vi.fn().mockImplementation(async (desc?: RTCSessionDescriptionInit) => {
    if (desc?.type === "rollback") {
      this.localDescription = null
      this.signalingState = "stable"
    } else {
      this.localDescription = desc ?? { type: "offer", sdp: "mock-sdp" }
    }
  })
  setRemoteDescription = vi.fn().mockResolvedValue(undefined)
  addIceCandidate = vi.fn().mockResolvedValue(undefined)
  restartIce = vi.fn()
  close = vi.fn()

  constructor() {
    MockRTCPeerConnection.instances.push(this)
  }
}

// ── Media mocks ───────────────────────────────────────────────────────────────

export const mockAudioTrack = {
  kind: "audio" as const,
  enabled: true,
  stop: vi.fn(),
}

export const mockVideoTrack = {
  kind: "video" as const,
  enabled: true,
  stop: vi.fn(),
  onended: null as (() => void) | null,
}

export const mockStream = {
  getTracks: vi.fn().mockReturnValue([mockAudioTrack, mockVideoTrack]),
  getAudioTracks: vi.fn().mockReturnValue([mockAudioTrack]),
  getVideoTracks: vi.fn().mockReturnValue([mockVideoTrack]),
}

export const mockScreenTrack = {
  kind: "video" as const,
  stop: vi.fn(),
  onended: null as (() => void) | null,
}

export const mockScreenStream = {
  getVideoTracks: vi.fn().mockReturnValue([mockScreenTrack]),
}

// ── Setup helpers ─────────────────────────────────────────────────────────────

/** Call in beforeEach to reset all mock state. */
export function resetMocks() {
  MockWebSocket.instances = []
  MockRTCPeerConnection.instances = []

  mockAudioTrack.enabled = true
  mockAudioTrack.stop.mockClear()
  mockVideoTrack.enabled = true
  mockVideoTrack.stop.mockClear()
  mockVideoTrack.onended = null
  mockScreenTrack.stop.mockClear()
  mockScreenTrack.onended = null

  // Re-apply mock implementations after vi.clearAllMocks may have wiped them
  ;(navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockResolvedValue(
    mockStream as unknown as MediaStream
  )
  ;(navigator.mediaDevices.getDisplayMedia as ReturnType<typeof vi.fn>).mockResolvedValue(
    mockScreenStream as unknown as MediaStream
  )
}

/** Install global stubs. Call once at module level in each test file. */
export function installGlobalMocks() {
  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
  globalThis.RTCPeerConnection = MockRTCPeerConnection as unknown as typeof RTCPeerConnection

  Object.defineProperty(navigator, "mediaDevices", {
    value: {
      getUserMedia: vi.fn().mockResolvedValue(mockStream as unknown as MediaStream),
      getDisplayMedia: vi.fn().mockResolvedValue(mockScreenStream as unknown as MediaStream),
    },
    writable: true,
  })
}
