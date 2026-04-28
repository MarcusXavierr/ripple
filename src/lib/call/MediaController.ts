import {
  getCameraProfile,
  getScreenProfile,
  type Profile,
  type ScreenSharePreset,
} from "@/lib/call/mediaProfile"
import { type ScreenShareSurface, useCallStore } from "@/store/call"

export class MediaController {
  private stream: MediaStream | null = null
  private pc: RTCPeerConnection | null = null
  private screenAudioTransceiver: RTCRtpTransceiver | null = null

  async init(): Promise<MediaStream> {
    const profile = getCameraProfile()
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: profile.captureConstraints,
        audio: true,
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === "OverconstrainedError") {
        console.warn("[MediaController] camera constraints rejected, falling back", err)
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      } else {
        throw err
      }
    }
    this.stream = stream
    return stream
  }

  async attachPC(pc: RTCPeerConnection) {
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
    const videoTrack = stream?.getVideoTracks()[0]
    const videoSender = pc.getSenders().find((s) => s.track?.kind === "video")
    if (videoTrack && videoSender) {
      await this.applyProfile(getCameraProfile(), videoTrack, videoSender)
    }
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

  async startScreenShare() {
    if (!this.pc) return
    try {
      const preset = useCallStore.getState().screenSharePreset
      const initialProfile = getScreenProfile({ preset, displaySurface: null })
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: initialProfile.captureConstraints,
        audio: true,
      })
      const screenTrack = screenStream.getVideoTracks()[0]
      const surfaceRaw = screenTrack.getSettings().displaySurface as
        | "monitor"
        | "window"
        | "browser"
        | "application"
        | undefined
      const screenShareSurface = toScreenShareSurface(surfaceRaw)
      const profile = getScreenProfile({ preset, displaySurface: surfaceRaw ?? null })

      const sender = this.pc.getSenders().find((s) => s.track?.kind === "video")
      if (sender) {
        await sender.replaceTrack(screenTrack)
      } else {
        this.pc.addTrack(screenTrack, screenStream)
      }
      const videoSender = this.pc.getSenders().find((s) => s.track?.kind === "video")
      if (videoSender) {
        await this.applyProfile(profile, screenTrack, videoSender)
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
      if (sender && cameraTrack) {
        await this.applyProfile(getCameraProfile(), cameraTrack, sender)
      }
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

  async applyScreenSharePreset(preset: ScreenSharePreset): Promise<void> {
    if (!this.pc) return
    if (!useCallStore.getState().isScreenSharing) return
    const sender = this.pc.getSenders().find((s) => s.track?.kind === "video")
    const track = sender?.track
    if (!sender || !track) return
    const surface =
      (track.getSettings().displaySurface as
        | "monitor"
        | "window"
        | "browser"
        | "application"
        | undefined) ?? null
    const profile = getScreenProfile({ preset, displaySurface: surface })
    await this.applyProfile(profile, track, sender)
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

  private async applyProfile(
    profile: Profile,
    track: MediaStreamTrack,
    sender: RTCRtpSender
  ): Promise<void> {
    try {
      track.contentHint = profile.contentHint
      const params = sender.getParameters()
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}]
      }
      params.encodings[0].maxBitrate = profile.maxBitrateBps
      params.degradationPreference = profile.degradationPreference
      await sender.setParameters(params)
    } catch (err) {
      console.warn("[MediaController] applyProfile failed", profile.name, err)
    }
  }
}

function toScreenShareSurface(value: string | undefined): ScreenShareSurface {
  if (value === "browser" || value === "window" || value === "monitor") {
    return value
  }
  return null
}
