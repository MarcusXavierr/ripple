import { beforeEach, describe, expect, it, vi } from "vitest"
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

installGlobalMocks()

describe("MediaController", () => {
  let media: MediaController

  beforeEach(() => {
    media = new MediaController()
    useCallStore.getState().reset()
    resetMocks()
  })

  describe("init()", () => {
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

  describe("camera profile", () => {
    it("calls getUserMedia with 1080p constraints, not { video: true }", async () => {
      await media.init()
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: {
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 30, max: 30, min: 15 },
        },
        audio: true,
      })
    })

    it("falls back to { video: true, audio: true } on OverconstrainedError", async () => {
      const gum = navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>
      const overconstrained = new DOMException("constraint", "OverconstrainedError")
      gum.mockRejectedValueOnce(overconstrained)
      // second call (the fallback) returns the normal mock stream
      await media.init()
      expect(gum).toHaveBeenCalledTimes(2)
      expect(gum).toHaveBeenLastCalledWith({ video: true, audio: true })
    })

    it("sets motion contentHint and 4 Mbps balanced on the video sender after attach", async () => {
      await media.init()
      const pc = new MockRTCPeerConnection() as unknown as RTCPeerConnection
      await media.attachPC(pc)

      expect(mockVideoTrack.contentHint).toBe("motion")

      const videoSender = (pc as unknown as MockRTCPeerConnection).senders.find(
        (s) => s.kind === "video"
      )
      expect(videoSender).toBeDefined()
      expect(videoSender!.setParameters).toHaveBeenCalledTimes(1)
      const params = videoSender!.setParameters.mock.calls[0][0] as RTCRtpSendParameters
      expect(params.encodings?.[0].maxBitrate).toBe(4_000_000)
      expect(params.degradationPreference).toBe("balanced")
    })
  })
})
