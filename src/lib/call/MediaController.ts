import { track } from "@/lib/analytics"
import { readDevicePref } from "@/lib/call/devicePreferences"
import { type ScreenShareSurface, useCallStore } from "@/store/call"

export class MediaController {
  private stream: MediaStream | null = null
  private pc: RTCPeerConnection | null = null
  private screenAudioTransceiver: RTCRtpTransceiver | null = null

  async init(): Promise<MediaStream> {
    const micPref = readDevicePref("mic")
    const camPref = readDevicePref("cam")
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: micPref ? { deviceId: { ideal: micPref } } : true,
      video: camPref ? { deviceId: { ideal: camPref } } : true,
    })
    this.stream = stream
    return stream
  }

  attachPC(pc: RTCPeerConnection) {
    this.pc = pc
    const stream = this.stream
    if (stream) stream.getTracks().forEach((t) => pc.addTrack(t, stream))
    this.screenAudioTransceiver = pc.addTransceiver("audio", {
      direction: "sendrecv",
      // Bundle into the existing local stream so the remote's `ontrack` event
      // carries the same MediaStream id as mic/camera. Without this, the remote
      // gets a streamless track and `e.streams[0]` is undefined, which would
      // cause PeerConnection.ts:52 to null out remoteStream.
      streams: stream ? [stream] : [],
    })
  }

  toggleMic() {
    const track = this.stream?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    useCallStore.setState({ isMicMuted: !track.enabled })
  }

  toggleCamera() {
    const track = this.stream?.getVideoTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    useCallStore.setState({ isCameraOff: !track.enabled })
  }

  async replaceTrack(kind: "mic" | "cam", deviceId: string): Promise<void> {
    if (!this.pc || !this.stream) return

    const freshStream = await navigator.mediaDevices.getUserMedia(
      kind === "mic"
        ? {
            audio: { deviceId: { exact: deviceId } },
            video: false,
          }
        : {
            audio: false,
            video: { deviceId: { exact: deviceId } },
          }
    )
    const newTrack =
      kind === "mic"
        ? (freshStream.getAudioTracks()[0] ?? null)
        : (freshStream.getVideoTracks()[0] ?? null)

    if (!newTrack) {
      freshStream.getTracks().forEach((track) => track.stop())
      return
    }

    const trackKind = kind === "mic" ? "audio" : "video"
    const oldTrack =
      kind === "mic"
        ? (this.stream.getAudioTracks()[0] ?? null)
        : (this.stream.getVideoTracks()[0] ?? null)

    if (oldTrack) {
      newTrack.enabled = oldTrack.enabled
    }

    const isSharing = useCallStore.getState().isScreenSharing
    const skipSenderSwap = kind === "cam" && isSharing
    const sender = this.pc.getSenders().find((candidate) => candidate.track?.kind === trackKind)

    if (!skipSenderSwap && sender) {
      await sender.replaceTrack(newTrack)
    }

    if (oldTrack) {
      this.stream.removeTrack(oldTrack)
      oldTrack.stop()
    }
    this.stream.addTrack(newTrack)
  }

  async startScreenShare() {
    if (!this.pc) return
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })
      const screenTrack = screenStream.getVideoTracks()[0]
      const screenShareSurface = toScreenShareSurface(screenTrack.getSettings().displaySurface)
      const sender = this.pc.getSenders().find((s) => s.track?.kind === "video")
      if (sender) {
        await sender.replaceTrack(screenTrack)
      } else {
        this.pc.addTrack(screenTrack, screenStream)
      }
      const screenAudio = screenStream.getAudioTracks()[0] ?? null
      if (screenAudio && this.screenAudioTransceiver) {
        await this.screenAudioTransceiver.sender.replaceTrack(screenAudio)
      } else {
        useCallStore.setState({
          notice: { kind: "info", messageKey: "room.toast.computerAudioUnavailable" },
        })
      }
      useCallStore.setState({ isScreenSharing: true, screenShareSurface })
      screenTrack.onended = () => {
        void this.stopScreenShare()
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        useCallStore.setState({ isScreenSharing: false, screenShareSurface: null })
        return
      }
      track("screenshare_error", {
        errorName: err instanceof DOMException ? err.name : "Unknown",
      })
      console.error("[Screenshare] failed to start", err)
      useCallStore.setState({ error: "Could not start screen share.", screenShareSurface: null })
    }
  }

  async stopScreenShare() {
    try {
      if (!this.pc) return
      const cameraTrack = this.stream?.getVideoTracks()[0] ?? null
      const sender = this.pc.getSenders().find((s) => s.track?.kind === "video")
      const screenTrack = sender?.track ?? null
      if (sender) await sender.replaceTrack(cameraTrack)
      if (screenTrack && screenTrack !== cameraTrack) screenTrack.stop()
      const audioSender = this.screenAudioTransceiver?.sender
      const screenAudioTrack = audioSender?.track ?? null
      if (audioSender) await audioSender.replaceTrack(null)
      screenAudioTrack?.stop()
    } catch (err) {
      console.error("[Screenshare] failed to stop", err)
    } finally {
      useCallStore.setState({ isScreenSharing: false, screenShareSurface: null })
    }
  }

  teardown() {
    if (this.pc) {
      const videoSender = this.pc.getSenders().find((s) => s.track?.kind === "video")
      const screenVideoTrack = videoSender?.track ?? null
      const cameraVideoTrack = this.stream?.getVideoTracks()[0] ?? null
      if (screenVideoTrack && screenVideoTrack !== cameraVideoTrack) {
        screenVideoTrack.stop()
      }
    }
    const screenAudioTrack = this.screenAudioTransceiver?.sender.track ?? null
    screenAudioTrack?.stop()

    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.pc = null
    this.screenAudioTransceiver = null
    useCallStore.setState({ screenShareSurface: null, isScreenSharing: false })
  }
}

function toScreenShareSurface(value: string | undefined): ScreenShareSurface {
  if (value === "browser" || value === "window" || value === "monitor") {
    return value
  }
  return null
}
