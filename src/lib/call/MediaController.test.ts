import { beforeEach, describe, expect, it, vi } from "vitest"
import { track } from "@/lib/analytics"
import { useCallStore } from "@/store/call"
import {
  installGlobalMocks,
  MockRTCPeerConnection,
  mockAudioTrack,
  mockScreenAudioTrack,
  mockScreenStream,
  mockScreenTrack,
  mockStream,
  mockVideoTrack,
  resetMocks,
} from "./__tests__/mocks"
import { MediaController } from "./MediaController"

const blurMocks = vi.hoisted(() => ({
  supported: true,
  create: vi.fn(),
}))

vi.mock("./BackgroundBlurProcessor", () => ({
  isBackgroundBlurSupported: () => blurMocks.supported,
  BackgroundBlurProcessor: { create: blurMocks.create },
}))

type FakeBlurTrack = {
  kind: "video"
  enabled: boolean
  readyState: MediaStreamTrackState
  source: MediaStreamTrack
  stop: () => void
}

type FakeBlur = {
  track: FakeBlurTrack
  level: "light" | "strong"
  setEnabled: (enabled: boolean) => void
  stop: () => void
  fail: () => void
}

function fakeBlur(
  level: "light" | "strong",
  source = mockVideoTrack as unknown as MediaStreamTrack,
  onFailure: (failed: FakeBlur) => void = () => {}
): FakeBlur {
  const track: FakeBlurTrack = {
    kind: "video",
    enabled: true,
    readyState: "live",
    source,
    stop() {
      track.readyState = "ended"
    },
  }
  const blur: FakeBlur = {
    track,
    level,
    setEnabled(enabled: boolean) {
      track.enabled = enabled
    },
    stop() {
      track.stop()
    },
    fail() {
      onFailure(blur)
    },
  }
  return blur
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  isAnalyticsEnabled: false,
  posthogClient: { capture: vi.fn() },
}))

installGlobalMocks()

const trackMock = vi.mocked(track)

function createTrack(kind: "audio" | "video", overrides?: Partial<MediaStreamTrack>) {
  return {
    kind,
    enabled: true,
    stop: vi.fn(),
    getSettings: vi.fn().mockReturnValue({
      deviceId: kind === "audio" ? "mic-fresh" : "cam-fresh",
    }),
    ...overrides,
  } as unknown as MediaStreamTrack
}

function createSingleTrackStream(track: MediaStreamTrack): MediaStream {
  return {
    getTracks: vi.fn(() => [track]),
    getAudioTracks: vi.fn(() => (track.kind === "audio" ? [track] : [])),
    getVideoTracks: vi.fn(() => (track.kind === "video" ? [track] : [])),
  } as unknown as MediaStream
}

describe("MediaController", () => {
  let media: MediaController

  beforeEach(() => {
    media = new MediaController()
    localStorage.clear()
    useCallStore.getState().reset()
    resetMocks()
    blurMocks.supported = true
    blurMocks.create.mockReset()
    blurMocks.create.mockImplementation(
      async (
        camera: MediaStreamTrack,
        level: "light" | "strong",
        onFailure: (failed: FakeBlur) => void
      ) => fakeBlur(level, camera, onFailure)
    )
    trackMock.mockReset()
  })

  describe("init()", () => {
    it("init() passes ideal deviceId for mic when localStorage has a pref", async () => {
      localStorage.setItem("ripple.devices.mic", "mic-2")
      await media.init()
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: { deviceId: { ideal: "mic-2" } },
        video: true,
      })
    })

    it("init() falls back to default constraint when no pref is stored", async () => {
      await media.init()
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: true,
        video: true,
      })
    })

    it("init() does not throw when persisted device is gone (ideal not exact)", async () => {
      localStorage.setItem("ripple.devices.cam", "cam-missing")
      await expect(media.init()).resolves.toBe(mockStream)
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: true,
        video: { deviceId: { ideal: "cam-missing" } },
      })
    })

    it("returns the acquired stream", async () => {
      const result = await media.init()
      expect(result).toBe(mockStream)
    })
  })

  describe("attachPC()", () => {
    it("adds all stream tracks to the peer connection", async () => {
      await media.init()
      const pc = new MockRTCPeerConnection() as unknown as RTCPeerConnection
      media.attachPC(pc)
      expect(pc.addTrack).toHaveBeenCalledTimes(2)
    })

    it("is a no-op when stream has not been initialized", () => {
      const pc = new MockRTCPeerConnection() as unknown as RTCPeerConnection
      media.attachPC(pc)
      expect(pc.addTrack).not.toHaveBeenCalled()
    })

    it("allocates a sendrecv audio transceiver bundled into the local stream", async () => {
      await media.init()
      const pc = new MockRTCPeerConnection() as unknown as RTCPeerConnection
      media.attachPC(pc)
      expect(pc.addTransceiver).toHaveBeenCalledWith("audio", {
        direction: "sendrecv",
        streams: [mockStream],
      })
    })

    it("creates the transceiver with no streams when called before init", () => {
      const pc = new MockRTCPeerConnection() as unknown as RTCPeerConnection
      media.attachPC(pc)
      expect(pc.addTransceiver).toHaveBeenCalledWith("audio", {
        direction: "sendrecv",
        streams: [],
      })
    })
  })

  describe("toggleMic()", () => {
    it("disables the audio track and sets isMicMuted=true in store", async () => {
      await media.init()
      media.toggleMic()
      expect(mockAudioTrack.enabled).toBe(false)
      expect(useCallStore.getState().isMicMuted).toBe(true)
    })

    it("re-enables track on second call and sets isMicMuted=false", async () => {
      await media.init()
      media.toggleMic()
      media.toggleMic()
      expect(mockAudioTrack.enabled).toBe(true)
      expect(useCallStore.getState().isMicMuted).toBe(false)
    })

    it("does not throw when stream is not initialized", () => {
      expect(() => media.toggleMic()).not.toThrow()
    })
  })

  describe("toggleCamera()", () => {
    it("disables the video track and sets isCameraOff=true in store", async () => {
      await media.init()
      media.toggleCamera()
      expect(mockVideoTrack.enabled).toBe(false)
      expect(useCallStore.getState().isCameraOff).toBe(true)
    })

    it("does not throw when stream is not initialized", () => {
      expect(() => media.toggleCamera()).not.toThrow()
    })
  })

  describe("teardown()", () => {
    it("stops all tracks", async () => {
      await media.init()
      media.teardown()
      expect(mockAudioTrack.stop).toHaveBeenCalled()
      expect(mockVideoTrack.stop).toHaveBeenCalled()
    })

    it("does not throw when called before init", () => {
      expect(() => media.teardown()).not.toThrow()
    })

    it("stops the screen video and screen audio tracks if a share is active", async () => {
      await media.init()
      const mockVideoSender: { track: unknown; replaceTrack: ReturnType<typeof vi.fn> } = {
        track: mockVideoTrack,
        replaceTrack: vi.fn().mockImplementation(async (track: unknown) => {
          mockVideoSender.track = track
        }),
      }
      const mockScreenAudioSender: { track: unknown; replaceTrack: ReturnType<typeof vi.fn> } = {
        track: null,
        replaceTrack: vi.fn().mockImplementation(async (track: unknown) => {
          mockScreenAudioSender.track = track
        }),
      }
      const pc = new MockRTCPeerConnection() as unknown as RTCPeerConnection
      vi.mocked(pc.getSenders).mockReturnValue([mockVideoSender as unknown as RTCRtpSender])
      vi.mocked(pc.addTransceiver).mockReturnValueOnce({
        sender: mockScreenAudioSender,
        direction: "sendrecv",
      } as unknown as RTCRtpTransceiver)
      media.attachPC(pc)
      await media.startScreenShare()

      media.teardown()

      expect(mockScreenTrack.stop).toHaveBeenCalled()
      expect(mockScreenAudioTrack.stop).toHaveBeenCalled()
    })
  })

  describe("startScreenShare()", () => {
    let mockVideoSender: { track: unknown; replaceTrack: ReturnType<typeof vi.fn> }
    let mockScreenAudioSender: { track: unknown; replaceTrack: ReturnType<typeof vi.fn> }

    beforeEach(async () => {
      await media.init()
      mockVideoSender = {
        track: mockVideoTrack,
        replaceTrack: vi.fn().mockImplementation(async (track: unknown) => {
          mockVideoSender.track = track
        }),
      }
      mockScreenAudioSender = {
        track: null,
        replaceTrack: vi.fn().mockImplementation(async (track: unknown) => {
          mockScreenAudioSender.track = track
        }),
      }
      const pc = new MockRTCPeerConnection() as unknown as RTCPeerConnection
      vi.mocked(pc.getSenders).mockReturnValue([mockVideoSender as unknown as RTCRtpSender])
      vi.mocked(pc.addTransceiver).mockReturnValueOnce({
        sender: mockScreenAudioSender,
        direction: "sendrecv",
      } as unknown as RTCRtpTransceiver)
      media.attachPC(pc)
    })

    it("replaces the video sender track with the screen track", async () => {
      await media.startScreenShare()
      expect(mockVideoSender.replaceTrack).toHaveBeenCalledWith(mockScreenTrack)
    })

    it("sets isScreenSharing to true in store", async () => {
      await media.startScreenShare()
      expect(useCallStore.getState().isScreenSharing).toBe(true)
    })

    it("stores the shared surface type when screen share starts", async () => {
      await media.startScreenShare()
      expect(useCallStore.getState().screenShareSurface).toBe("browser")
    })

    it("is a no-op when no PC has been attached", async () => {
      const mediaWithoutPC = new MediaController()
      await mediaWithoutPC.init()
      await mediaWithoutPC.startScreenShare()
      expect(useCallStore.getState().isScreenSharing).toBe(false)
    })

    it("does not throw when user cancels the screen picker", async () => {
      vi.mocked(navigator.mediaDevices.getDisplayMedia).mockRejectedValueOnce(
        new DOMException("cancelled", "NotAllowedError")
      )
      await expect(media.startScreenShare()).resolves.not.toThrow()
      expect(useCallStore.getState().isScreenSharing).toBe(false)
      expect(useCallStore.getState().screenShareSurface).toBeNull()
    })

    it("screenshare_error NOT emitted on NotAllowedError and still resets state", async () => {
      vi.mocked(navigator.mediaDevices.getDisplayMedia).mockRejectedValueOnce(
        new DOMException("cancelled", "NotAllowedError")
      )

      await media.startScreenShare()

      expect(trackMock).not.toHaveBeenCalledWith("screenshare_error", expect.anything())
      expect(useCallStore.getState().isScreenSharing).toBe(false)
      expect(useCallStore.getState().screenShareSurface).toBeNull()
    })

    it("screenshare_error emitted on generic failure", async () => {
      vi.mocked(navigator.mediaDevices.getDisplayMedia).mockRejectedValueOnce(
        new DOMException("failed", "AbortError")
      )

      await media.startScreenShare()

      expect(trackMock).toHaveBeenCalledWith("screenshare_error", { errorName: "AbortError" })
    })

    it("routes the screen audio track to the dedicated transceiver, not the mic", async () => {
      await media.startScreenShare()
      expect(mockScreenAudioSender.replaceTrack).toHaveBeenCalledWith(mockScreenAudioTrack)
    })

    it("sets an info notice and skips audio when the picker returned no audio track", async () => {
      vi.mocked(mockScreenStream.getAudioTracks).mockReturnValueOnce([])
      await media.startScreenShare()
      expect(mockScreenAudioSender.replaceTrack).not.toHaveBeenCalled()
      expect(useCallStore.getState().notice).toEqual({
        kind: "info",
        messageKey: "room.toast.computerAudioUnavailable",
      })
      expect(useCallStore.getState().isScreenSharing).toBe(true)
    })
  })

  describe("stopScreenShare()", () => {
    let mockVideoSender: { track: unknown; replaceTrack: ReturnType<typeof vi.fn> }
    let mockScreenAudioSender: { track: unknown; replaceTrack: ReturnType<typeof vi.fn> }

    beforeEach(async () => {
      await media.init()
      mockVideoSender = {
        track: mockVideoTrack,
        replaceTrack: vi.fn().mockImplementation(async (track: unknown) => {
          mockVideoSender.track = track
        }),
      }
      mockScreenAudioSender = {
        track: null,
        replaceTrack: vi.fn().mockImplementation(async (track: unknown) => {
          mockScreenAudioSender.track = track
        }),
      }
      const pc = new MockRTCPeerConnection() as unknown as RTCPeerConnection
      vi.mocked(pc.getSenders).mockReturnValue([mockVideoSender as unknown as RTCRtpSender])
      vi.mocked(pc.addTransceiver).mockReturnValueOnce({
        sender: mockScreenAudioSender,
        direction: "sendrecv",
      } as unknown as RTCRtpTransceiver)
      media.attachPC(pc)
      await media.startScreenShare()
    })

    it("sets isScreenSharing to false", async () => {
      await media.stopScreenShare()
      expect(useCallStore.getState().isScreenSharing).toBe(false)
    })

    it("clears the shared surface when screen share stops", async () => {
      await media.stopScreenShare()
      expect(useCallStore.getState().screenShareSurface).toBeNull()
    })

    it("replaces the screen track with the camera track on the sender", async () => {
      await media.stopScreenShare()
      expect(mockVideoSender.replaceTrack).toHaveBeenLastCalledWith(mockVideoTrack)
    })

    it("sets isScreenSharing=false even when replaceTrack throws", async () => {
      mockVideoSender.replaceTrack.mockRejectedValueOnce(new Error("track error"))
      await media.stopScreenShare()
      expect(useCallStore.getState().isScreenSharing).toBe(false)
    })

    it("clears the screen-audio sender on stop", async () => {
      await media.stopScreenShare()
      expect(mockScreenAudioSender.replaceTrack).toHaveBeenLastCalledWith(null)
    })

    it("stops the screen audio track on stop", async () => {
      await media.stopScreenShare()
      expect(mockScreenAudioTrack.stop).toHaveBeenCalled()
    })
  })

  describe("replaceTrack()", () => {
    beforeEach(async () => {
      await media.init()
    })

    it("replaceTrack(mic) swaps the audio sender to a new track", async () => {
      const newTrack = createTrack("audio")
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce(
        createSingleTrackStream(newTrack)
      )
      const sender = {
        track: mockAudioTrack,
        replaceTrack: vi.fn().mockResolvedValue(undefined),
      }
      const pc = new MockRTCPeerConnection() as unknown as RTCPeerConnection
      vi.mocked(pc.getSenders).mockReturnValue([sender as unknown as RTCRtpSender])
      media.attachPC(pc)

      await media.replaceTrack("mic", "mic-2")

      expect(sender.replaceTrack).toHaveBeenCalledWith(newTrack)
    })

    it("replaceTrack(cam) swaps the video sender", async () => {
      const newTrack = createTrack("video")
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce(
        createSingleTrackStream(newTrack)
      )
      const sender = {
        track: mockVideoTrack,
        replaceTrack: vi.fn().mockResolvedValue(undefined),
      }
      const pc = new MockRTCPeerConnection() as unknown as RTCPeerConnection
      vi.mocked(pc.getSenders).mockReturnValue([sender as unknown as RTCRtpSender])
      media.attachPC(pc)

      await media.replaceTrack("cam", "cam-2")

      expect(sender.replaceTrack).toHaveBeenCalledWith(newTrack)
    })

    it("old track is stopped only after replaceTrack resolves", async () => {
      const newTrack = createTrack("audio")
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce(
        createSingleTrackStream(newTrack)
      )
      let resolveReplace!: () => void
      const sender = {
        track: mockAudioTrack,
        replaceTrack: vi.fn().mockImplementation(
          () =>
            new Promise<void>((resolve) => {
              resolveReplace = resolve
            })
        ),
      }
      const pc = new MockRTCPeerConnection() as unknown as RTCPeerConnection
      vi.mocked(pc.getSenders).mockReturnValue([sender as unknown as RTCRtpSender])
      media.attachPC(pc)

      const pending = media.replaceTrack("mic", "mic-2")
      await Promise.resolve()
      expect(mockAudioTrack.stop).not.toHaveBeenCalled()

      resolveReplace()
      await pending

      expect(mockAudioTrack.stop).toHaveBeenCalledOnce()
    })

    it("new track inherits enabled state from old track", async () => {
      mockAudioTrack.enabled = false
      const newTrack = createTrack("audio")
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce(
        createSingleTrackStream(newTrack)
      )
      const sender = {
        track: mockAudioTrack,
        replaceTrack: vi.fn().mockResolvedValue(undefined),
      }
      const pc = new MockRTCPeerConnection() as unknown as RTCPeerConnection
      vi.mocked(pc.getSenders).mockReturnValue([sender as unknown as RTCRtpSender])
      media.attachPC(pc)

      await media.replaceTrack("mic", "mic-2")

      expect(newTrack.enabled).toBe(false)
    })

    it("no-op when pc or stream are not initialized", async () => {
      await expect(new MediaController().replaceTrack("mic", "mic-2")).resolves.toBeUndefined()
    })

    it("replaceTrack(cam) while isScreenSharing does NOT touch the video sender", async () => {
      const newTrack = createTrack("video", {
        getSettings: vi.fn().mockReturnValue({ deviceId: "cam-2" }),
      })
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce(
        createSingleTrackStream(newTrack)
      )
      const sender = {
        track: mockScreenTrack,
        replaceTrack: vi.fn().mockResolvedValue(undefined),
      }
      const pc = new MockRTCPeerConnection() as unknown as RTCPeerConnection
      vi.mocked(pc.getSenders).mockReturnValue([sender as unknown as RTCRtpSender])
      media.attachPC(pc)
      useCallStore.setState({ isScreenSharing: true })

      await media.replaceTrack("cam", "cam-2")

      expect(sender.replaceTrack).not.toHaveBeenCalled()
      expect(sender.track).toBe(mockScreenTrack)
    })

    it("replaceTrack(cam) while isScreenSharing still updates this.stream so stopScreenShare restores the new camera", async () => {
      const newTrack = createTrack("video", {
        getSettings: vi.fn().mockReturnValue({ deviceId: "cam-2" }),
      })
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce(
        createSingleTrackStream(newTrack)
      )
      const sender: { track: MediaStreamTrack | null; replaceTrack: ReturnType<typeof vi.fn> } = {
        track: mockScreenTrack as unknown as MediaStreamTrack,
        replaceTrack: vi.fn().mockImplementation(async (track: MediaStreamTrack | null) => {
          sender.track = track
        }),
      }
      const screenAudioSender = {
        track: mockScreenAudioTrack,
        replaceTrack: vi.fn().mockResolvedValue(undefined),
      }
      const pc = new MockRTCPeerConnection() as unknown as RTCPeerConnection
      vi.mocked(pc.getSenders).mockReturnValue([sender as unknown as RTCRtpSender])
      vi.mocked(pc.addTransceiver).mockReturnValueOnce({
        sender: screenAudioSender,
        direction: "sendrecv",
      } as unknown as RTCRtpTransceiver)
      media.attachPC(pc)
      useCallStore.setState({ isScreenSharing: true })

      await media.replaceTrack("cam", "cam-2")
      await media.stopScreenShare()

      expect(sender.replaceTrack).toHaveBeenLastCalledWith(newTrack)
    })

    it("replaceTrack(mic) while isScreenSharing still swaps the audio sender", async () => {
      const newTrack = createTrack("audio")
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce(
        createSingleTrackStream(newTrack)
      )
      const micSender = {
        track: mockAudioTrack,
        replaceTrack: vi.fn().mockResolvedValue(undefined),
      }
      const videoSender = {
        track: mockScreenTrack,
        replaceTrack: vi.fn().mockResolvedValue(undefined),
      }
      const pc = new MockRTCPeerConnection() as unknown as RTCPeerConnection
      vi.mocked(pc.getSenders).mockReturnValue([
        micSender as unknown as RTCRtpSender,
        videoSender as unknown as RTCRtpSender,
      ])
      media.attachPC(pc)
      useCallStore.setState({ isScreenSharing: true })

      await media.replaceTrack("mic", "mic-2")

      expect(micSender.replaceTrack).toHaveBeenCalledWith(newTrack)
      expect(videoSender.replaceTrack).not.toHaveBeenCalled()
    })
  })

  describe("background blur", () => {
    async function withVideoSender() {
      await media.init()
      const sender: { track: MediaStreamTrack | null; replaceTrack: ReturnType<typeof vi.fn> } = {
        track: mockVideoTrack as unknown as MediaStreamTrack,
        replaceTrack: vi.fn().mockImplementation(async (track: MediaStreamTrack | null) => {
          sender.track = track
        }),
      }
      const pc = new MockRTCPeerConnection() as unknown as RTCPeerConnection
      vi.mocked(pc.getSenders).mockReturnValue([sender as unknown as RTCRtpSender])
      media.attachPC(pc)
      return { sender, pc }
    }

    it("sends blurred camera to the peer and self preview, then restores the raw camera", async () => {
      const { sender } = await withVideoSender()
      await media.setBackgroundBlur("strong")
      const processor = await blurMocks.create.mock.results[0].value
      expect(sender.track).toBe(processor.track)
      expect(useCallStore.getState().localPreviewStream?.getVideoTracks()[0]).toBe(processor.track)
      expect(useCallStore.getState().backgroundBlur).toBe("strong")

      await media.setBackgroundBlur("light")
      expect(sender.track).toBe(processor.track)
      expect(useCallStore.getState().backgroundBlur).toBe("light")

      await media.setBackgroundBlur("off")
      expect(sender.track).toBe(mockVideoTrack)
      expect(useCallStore.getState().localPreviewStream).toBeNull()
      expect(processor.track.readyState).toBe("ended")
    })

    it("restores the processed camera after screen sharing", async () => {
      const { sender } = await withVideoSender()
      await media.setBackgroundBlur("strong")
      const processed = sender.track
      await media.startScreenShare()
      await media.stopScreenShare()
      expect(sender.track).toBe(processed)
      expect(sender.track).not.toBe(mockVideoTrack)
    })

    it("keeps the selected blur on a replacement camera", async () => {
      const { sender } = await withVideoSender()
      await media.setBackgroundBlur("strong")
      const previous = await blurMocks.create.mock.results[0].value
      const camera = createTrack("video")
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce(
        createSingleTrackStream(camera)
      )

      await media.replaceTrack("cam", "cam-2")
      const next = await blurMocks.create.mock.results[1].value
      expect(sender.track).toBe(next.track)
      expect(sender.track).toMatchObject({ source: camera })
      expect(useCallStore.getState().localPreviewStream?.getVideoTracks()[0]).toBe(next.track)
      expect(previous.track.readyState).toBe("ended")
    })

    it("reports a load failure and turns the camera off", async () => {
      const { sender } = await withVideoSender()
      blurMocks.create.mockRejectedValueOnce(new Error("CDN unavailable"))
      const error = vi.spyOn(console, "error").mockImplementation(() => {})
      try {
        await media.setBackgroundBlur("light")
      } finally {
        error.mockRestore()
      }
      expect(sender.track).toBe(mockVideoTrack)
      expect(mockVideoTrack.enabled).toBe(false)
      expect(useCallStore.getState()).toMatchObject({
        backgroundBlur: "off",
        isCameraOff: true,
        localPreviewStream: null,
        notice: { kind: "error", messageKey: "room.toast.backgroundBlurFailed" },
      })
    })

    it("discards a processor arriving after blur was turned off", async () => {
      const { sender } = await withVideoSender()
      let resolve!: (processor: FakeBlur) => void
      blurMocks.create.mockImplementationOnce(
        () =>
          new Promise<FakeBlur>((done) => {
            resolve = done
          })
      )
      const pending = media.setBackgroundBlur("light")
      await media.setBackgroundBlur("off")
      const late = fakeBlur("light")
      resolve(late)
      await pending
      expect(sender.track).toBe(mockVideoTrack)
      expect(useCallStore.getState().localPreviewStream).toBeNull()
      expect(late.track.readyState).toBe("ended")
    })

    it("keeps the processed camera disabled while the user turns the camera off", async () => {
      const { sender } = await withVideoSender()
      await media.setBackgroundBlur("strong")
      const processed = sender.track
      media.toggleCamera()
      expect(mockVideoTrack.enabled).toBe(false)
      expect(processed?.enabled).toBe(false)
      media.toggleCamera()
      expect(processed?.enabled).toBe(true)
    })

    it("keeps screen share visible during camera replacement and restores the new blurred camera", async () => {
      const { sender } = await withVideoSender()
      await media.setBackgroundBlur("strong")
      await media.startScreenShare()
      const camera = createTrack("video")
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce(
        createSingleTrackStream(camera)
      )
      await media.replaceTrack("cam", "cam-2")
      expect(sender.track).toBe(mockScreenTrack)
      const next = await blurMocks.create.mock.results[1].value
      await media.stopScreenShare()
      expect(sender.track).toBe(next.track)
      expect(useCallStore.getState().localPreviewStream?.getVideoTracks()[0]).toBe(next.track)
    })

    it("ignores an invalid saved level", async () => {
      localStorage.setItem("ripple.backgroundBlur", "banana")
      const stream = await media.init()
      const pc = new MockRTCPeerConnection() as unknown as RTCPeerConnection
      media.attachPC(pc)
      expect(pc.addTrack).toHaveBeenCalledWith(mockVideoTrack, stream)
      expect(useCallStore.getState().localPreviewStream).toBeNull()
      expect(useCallStore.getState().backgroundBlur).toBe("off")
    })

    it("keeps the new camera off when the user turns the camera off while blur restarts", async () => {
      const { sender } = await withVideoSender()
      await media.setBackgroundBlur("strong")
      const camera = createTrack("video")
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce(
        createSingleTrackStream(camera)
      )
      const restart = deferred<FakeBlur>()
      blurMocks.create.mockImplementationOnce(() => restart.promise)

      const switching = media.replaceTrack("cam", "cam-2")
      await vi.waitFor(() => expect(blurMocks.create).toHaveBeenCalledTimes(2))
      media.toggleCamera()
      restart.resolve(fakeBlur("strong", camera))
      await switching

      expect(sender.track).toMatchObject({ source: camera, enabled: false })
      expect(camera.enabled).toBe(false)
      expect(useCallStore.getState().isCameraOff).toBe(true)
    })

    it("releases the new camera when the call ends while blur restarts", async () => {
      await withVideoSender()
      await media.setBackgroundBlur("strong")
      const camera = createTrack("video")
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce(
        createSingleTrackStream(camera)
      )
      const restart = deferred<FakeBlur>()
      blurMocks.create.mockImplementationOnce(() => restart.promise)

      const switching = media.replaceTrack("cam", "cam-2")
      await vi.waitFor(() => expect(blurMocks.create).toHaveBeenCalledTimes(2))
      media.teardown()
      const late = fakeBlur("strong", camera)
      restart.resolve(late)
      await switching

      expect(camera.stop).toHaveBeenCalled()
      expect(late.track.readyState).toBe("ended")
    })

    it("applies a blur level chosen during a camera switch to the new camera", async () => {
      const { sender } = await withVideoSender()
      await media.setBackgroundBlur("strong")
      const camera = createTrack("video")
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce(
        createSingleTrackStream(camera)
      )
      const restart = deferred<FakeBlur>()
      blurMocks.create.mockImplementationOnce(() => restart.promise)

      const switching = media.replaceTrack("cam", "cam-2")
      await vi.waitFor(() => expect(blurMocks.create).toHaveBeenCalledTimes(2))
      await media.setBackgroundBlur("off")
      await media.setBackgroundBlur("light")
      restart.resolve(fakeBlur("strong", camera))
      await switching

      expect(sender.track).toMatchObject({ source: camera, readyState: "live" })
      expect(useCallStore.getState().localPreviewStream?.getVideoTracks()[0]).toBe(sender.track)
      expect(useCallStore.getState().backgroundBlur).toBe("light")
    })

    it("sends the blurred camera when blur finishes loading while screen sharing stops", async () => {
      const { sender } = await withVideoSender()
      await media.startScreenShare()
      const load = deferred<FakeBlur>()
      blurMocks.create.mockImplementationOnce(() => load.promise)
      const enabling = media.setBackgroundBlur("light")
      await vi.waitFor(() => expect(blurMocks.create).toHaveBeenCalledOnce())
      const swap = deferred<void>()
      sender.replaceTrack.mockImplementationOnce(async (track: MediaStreamTrack | null) => {
        await swap.promise
        sender.track = track
      })

      const stopping = media.stopScreenShare()
      load.resolve(fakeBlur("light"))
      await enabling
      swap.resolve()
      await stopping

      expect(sender.track).not.toBe(mockVideoTrack)
      expect(sender.track).toBe(useCallStore.getState().localPreviewStream?.getVideoTracks()[0])
    })

    it("turns blur off when the peer cannot switch to the blurred camera", async () => {
      const { sender } = await withVideoSender()
      sender.replaceTrack.mockRejectedValueOnce(new Error("connection closed"))
      const error = vi.spyOn(console, "error").mockImplementation(() => {})
      try {
        await media.setBackgroundBlur("light")
      } finally {
        error.mockRestore()
      }
      const processor = await blurMocks.create.mock.results[0].value
      expect(processor.track.readyState).toBe("ended")
      expect(mockVideoTrack.enabled).toBe(false)
      expect(useCallStore.getState()).toMatchObject({
        backgroundBlur: "off",
        isCameraOff: true,
        localPreviewStream: null,
        notice: { kind: "error", messageKey: "room.toast.backgroundBlurFailed" },
      })
    })

    it("turns the camera off when the blur pipeline breaks", async () => {
      const { sender } = await withVideoSender()
      await media.setBackgroundBlur("strong")
      const processor = await blurMocks.create.mock.results[0].value

      processor.fail()

      await vi.waitFor(() => expect(processor.track.readyState).toBe("ended"))
      expect(sender.track).toBe(mockVideoTrack)
      expect(mockVideoTrack.enabled).toBe(false)
      expect(useCallStore.getState()).toMatchObject({
        backgroundBlur: "off",
        isCameraOff: true,
        localPreviewStream: null,
        notice: { kind: "error", messageKey: "room.toast.backgroundBlurFailed" },
      })
    })

    it("stops the new blurred camera when the peer rejects a camera switch", async () => {
      const { sender } = await withVideoSender()
      await media.setBackgroundBlur("strong")
      const camera = createTrack("video")
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce(
        createSingleTrackStream(camera)
      )
      sender.replaceTrack.mockRejectedValueOnce(new Error("connection closed"))

      await expect(media.replaceTrack("cam", "cam-2")).rejects.toThrow("connection closed")

      const next = await blurMocks.create.mock.results[1].value
      expect(next.track.readyState).toBe("ended")
      expect(camera.stop).toHaveBeenCalled()
    })

    it("waits for the saved blur before joining, even if the level changes meanwhile", async () => {
      localStorage.setItem("ripple.backgroundBlur", "strong")
      const first = deferred<FakeBlur>()
      const second = deferred<FakeBlur>()
      blurMocks.create
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => second.promise)
      let entered = false
      const entering = media.init().then((stream) => {
        entered = true
        return stream
      })

      await vi.waitFor(() => expect(blurMocks.create).toHaveBeenCalledOnce())
      expect(entered).toBe(false)

      const choosing = media.setBackgroundBlur("light")
      const stale = fakeBlur("strong")
      first.resolve(stale)
      await vi.waitFor(() => expect(stale.track.readyState).toBe("ended"))
      expect(entered).toBe(false)

      const chosen = fakeBlur("light")
      second.resolve(chosen)
      const [stream] = await Promise.all([entering, choosing])

      const pc = new MockRTCPeerConnection() as unknown as RTCPeerConnection
      media.attachPC(pc)
      expect(pc.addTrack).toHaveBeenCalledWith(chosen.track, stream)
      expect(pc.addTrack).not.toHaveBeenCalledWith(mockVideoTrack, expect.anything())
      expect(useCallStore.getState().backgroundBlur).toBe("light")
    })

    it("joins with the camera off when the saved blur fails to load", async () => {
      localStorage.setItem("ripple.backgroundBlur", "strong")
      blurMocks.create.mockRejectedValueOnce(new Error("CDN unavailable"))
      const error = vi.spyOn(console, "error").mockImplementation(() => {})
      let stream: MediaStream
      try {
        stream = await media.init()
      } finally {
        error.mockRestore()
      }

      expect(useCallStore.getState()).toMatchObject({
        backgroundBlur: "off",
        isCameraOff: true,
        localPreviewStream: null,
        notice: { kind: "error", messageKey: "room.toast.backgroundBlurFailed" },
      })
      expect(mockVideoTrack.enabled).toBe(false)
      const pc = new MockRTCPeerConnection() as unknown as RTCPeerConnection
      media.attachPC(pc)
      expect(pc.addTrack).toHaveBeenCalledWith(mockVideoTrack, stream)
    })

    it("joins with the camera off when the saved blur takes too long", async () => {
      localStorage.setItem("ripple.backgroundBlur", "strong")
      const load = deferred<FakeBlur>()
      blurMocks.create.mockImplementationOnce(() => load.promise)
      const error = vi.spyOn(console, "error").mockImplementation(() => {})
      vi.useFakeTimers()
      try {
        const entering = media.init()
        await vi.waitFor(() => expect(blurMocks.create).toHaveBeenCalledOnce())
        await vi.advanceTimersByTimeAsync(10_000)
        await entering
      } finally {
        vi.useRealTimers()
        error.mockRestore()
      }

      expect(useCallStore.getState()).toMatchObject({
        backgroundBlur: "off",
        isCameraOff: true,
        localPreviewStream: null,
        notice: { kind: "error", messageKey: "room.toast.backgroundBlurFailed" },
      })
      expect(mockVideoTrack.enabled).toBe(false)

      const late = fakeBlur("strong")
      load.resolve(late)
      await vi.waitFor(() => expect(late.track.readyState).toBe("ended"))
      expect(useCallStore.getState().localPreviewStream).toBeNull()
    })

    it("turns the new camera off when blur cannot restart on it", async () => {
      const { sender } = await withVideoSender()
      await media.setBackgroundBlur("strong")
      const camera = createTrack("video")
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce(
        createSingleTrackStream(camera)
      )
      blurMocks.create.mockRejectedValueOnce(new Error("CDN unavailable"))
      const error = vi.spyOn(console, "error").mockImplementation(() => {})
      try {
        await media.replaceTrack("cam", "cam-2")
      } finally {
        error.mockRestore()
      }

      expect(sender.track).toBe(camera)
      expect(camera.enabled).toBe(false)
      expect(useCallStore.getState()).toMatchObject({
        backgroundBlur: "off",
        isCameraOff: true,
        notice: { kind: "error", messageKey: "room.toast.backgroundBlurFailed" },
      })
    })

    it("sends the unblurred camera once the user turns the camera back on", async () => {
      const { sender } = await withVideoSender()
      blurMocks.create.mockRejectedValueOnce(new Error("CDN unavailable"))
      const error = vi.spyOn(console, "error").mockImplementation(() => {})
      try {
        await media.setBackgroundBlur("light")
      } finally {
        error.mockRestore()
      }

      media.toggleCamera()

      expect(sender.track).toBe(mockVideoTrack)
      expect(mockVideoTrack.enabled).toBe(true)
      expect(useCallStore.getState()).toMatchObject({ isCameraOff: false, backgroundBlur: "off" })
    })
  })
})
