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
    if (!this.onmessage) throw new Error("onmessage not set on MockWebSocket")
    this.onmessage(new MessageEvent("message", { data: JSON.stringify(data) }))
  }

  /** Simulate the WS closing. */
  simulateClose(code: number) {
    if (!this.onclose) throw new Error("onclose not set on MockWebSocket")
    this.onclose(new CloseEvent("close", { code, wasClean: code === 1000 }))
  }
}

// ── RTCPeerConnection mock ────────────────────────────────────────────────────

export class MockRTCDataChannel {
  label: string
  readyState: RTCDataChannelState = "connecting"
  _sent: string[] = []

  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((e: MessageEvent) => void) | null = null

  send = vi.fn((data: string) => {
    this._sent.push(data)
  })

  constructor(label: string) {
    this.label = label
  }

  _fireOpen() {
    this.readyState = "open"
    this.onopen?.()
  }

  _fireMessage(data: string) {
    this.onmessage?.(new MessageEvent("message", { data }))
  }

  _fireClose() {
    this.readyState = "closed"
    this.onclose?.()
  }
}

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
  ondatachannel: ((e: { channel: MockRTCDataChannel }) => void) | null = null

  _createdChannels: Array<{ label: string; init: RTCDataChannelInit | undefined }> = []

  senders: Array<{
    track: MediaStreamTrack | null
    kind: "audio" | "video"
    getParameters: ReturnType<typeof vi.fn>
    setParameters: ReturnType<typeof vi.fn>
    replaceTrack: ReturnType<typeof vi.fn>
  }> = []

  addTrack = vi.fn((track: MediaStreamTrack) => {
    const sender = {
      track: track as MediaStreamTrack | null,
      kind: track.kind as "audio" | "video",
      getParameters: vi.fn(() => ({ encodings: [{}] })),
      setParameters: vi.fn().mockResolvedValue(undefined),
      replaceTrack: vi.fn().mockImplementation(async (t: MediaStreamTrack | null) => {
        sender.track = t
      }),
    }
    this.senders.push(sender)
    return sender
  })
  getSenders = vi.fn(() => this.senders)
  addTransceiver = vi.fn().mockImplementation((_kind: string, _init?: RTCRtpTransceiverInit) => {
    const sender = {
      track: null as MediaStreamTrack | null,
      replaceTrack: vi.fn().mockImplementation(async (track: MediaStreamTrack | null) => {
        sender.track = track
      }),
    }
    return { sender, direction: _init?.direction ?? "sendrecv" }
  })
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

  createDataChannel = vi.fn((label: string, init?: RTCDataChannelInit) => {
    const ch = new MockRTCDataChannel(label)
    this._createdChannels.push({ label, init })
    return ch
  })

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
  contentHint: "" as MediaStreamTrack["contentHint"],
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
  contentHint: "" as MediaStreamTrack["contentHint"],
  stop: vi.fn(),
  onended: null as (() => void) | null,
  getSettings: vi.fn().mockReturnValue({ displaySurface: "browser" }),
}

export const mockScreenAudioTrack = {
  kind: "audio" as const,
  stop: vi.fn(),
}

export const mockScreenStream = {
  getVideoTracks: vi.fn().mockReturnValue([mockScreenTrack]),
  getAudioTracks: vi.fn().mockReturnValue([mockScreenAudioTrack]),
}

// ── Setup helpers ─────────────────────────────────────────────────────────────

/** Call in beforeEach to reset all mock state. */
export function resetMocks() {
  MockWebSocket.instances = []
  MockRTCPeerConnection.instances = []
  // _createdChannels is per-instance; instances array reset above clears them

  mockAudioTrack.enabled = true
  mockAudioTrack.stop.mockClear()
  mockVideoTrack.enabled = true
  mockVideoTrack.contentHint = ""
  mockVideoTrack.stop.mockClear()
  mockVideoTrack.onended = null
  mockScreenTrack.contentHint = ""
  mockScreenTrack.stop.mockClear()
  mockScreenTrack.onended = null
  mockScreenTrack.getSettings.mockReset()
  mockScreenTrack.getSettings.mockReturnValue({ displaySurface: "browser" })
  mockScreenAudioTrack.stop.mockClear()
  mockScreenStream.getAudioTracks.mockReset()
  mockScreenStream.getAudioTracks.mockReturnValue([mockScreenAudioTrack])

  // Reset call history and re-apply mock implementations
  ;(navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockClear()
  ;(navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockResolvedValue(
    mockStream as unknown as MediaStream
  )
  ;(navigator.mediaDevices.getDisplayMedia as ReturnType<typeof vi.fn>).mockClear()
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
