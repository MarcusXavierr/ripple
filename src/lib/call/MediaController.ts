import { track } from "@/lib/analytics"
import {
  BackgroundBlurProcessor,
  isBackgroundBlurSupported,
} from "@/lib/call/BackgroundBlurProcessor"
import { readBackgroundBlurPref, readDevicePref } from "@/lib/call/devicePreferences"
import { type BackgroundBlurLevel, type ScreenShareSurface, useCallStore } from "@/store/call"

const BLUR_START_TIMEOUT_MS = 10_000

export class MediaController {
  private stream: MediaStream | null = null
  private pc: RTCPeerConnection | null = null
  private screenAudioTransceiver: RTCRtpTransceiver | null = null
  private blur: BackgroundBlurProcessor | null = null
  private blurRequest = 0
  private blurSync: Promise<void> = Promise.resolve()

  private outgoingCameraTrack(): MediaStreamTrack | null {
    return this.blur?.track ?? this.stream?.getVideoTracks()[0] ?? null
  }

  // Returns false only when the peer rejected the swap; nothing to send counts as success.
  private async sendCurrentCameraTrack(): Promise<boolean> {
    if (!this.pc || useCallStore.getState().isScreenSharing) return true
    const sender = this.pc.getSenders().find((candidate) => candidate.track?.kind === "video")
    const video = this.outgoingCameraTrack()
    if (!sender || !video) return true
    try {
      await sender.replaceTrack(video)
      return true
    } catch (err) {
      console.error("[BackgroundBlur] failed to swap sender track", err)
      return false
    }
  }

  async init(): Promise<MediaStream> {
    const micPref = readDevicePref("mic")
    const camPref = readDevicePref("cam")
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: micPref ? { deviceId: { ideal: micPref } } : true,
      video: camPref ? { deviceId: { ideal: camPref } } : true,
    })
    this.stream = stream
    const level = readBackgroundBlurPref()
    if (level !== "off" && isBackgroundBlurSupported()) {
      useCallStore.setState({ backgroundBlur: level })
      await this.waitForSavedBlur()
    }
    return stream
  }

  // Holds the call entry until the saved blur is live, so the peer never sees the raw camera.
  private async waitForSavedBlur(): Promise<void> {
    void this.syncBackgroundBlur()
    let timer: ReturnType<typeof setTimeout> | undefined
    // Executor form: tsconfig lib is ES2023, which has no Promise.withResolvers typing.
    const timedOut = new Promise<true>((done) => {
      timer = setTimeout(() => done(true), BLUR_START_TIMEOUT_MS)
    })
    const settled = (async () => {
      let pending: Promise<void>
      do {
        pending = this.blurSync
        await pending
      } while (pending !== this.blurSync) // a level change during the wait started a newer sync
      return false as const
    })()
    const didTimeOut = await Promise.race([settled, timedOut])
    clearTimeout(timer)
    if (!didTimeOut || !this.stream) return // settled, or the call ended while waiting
    console.error("[BackgroundBlur] saved blur took too long to start")
    this.reportBlurFailure()
    await this.syncBackgroundBlur()
  }

  attachPC(pc: RTCPeerConnection) {
    this.pc = pc
    const stream = this.stream
    if (stream) {
      stream.getAudioTracks().forEach((audio) => pc.addTrack(audio, stream))
      const video = this.outgoingCameraTrack()
      if (video) pc.addTrack(video, stream)
    }
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
    this.blur?.setEnabled(track.enabled)
    useCallStore.setState({ isCameraOff: !track.enabled })
  }

  async setBackgroundBlur(level: BackgroundBlurLevel): Promise<void> {
    useCallStore.setState({ backgroundBlur: level })
    await this.syncBackgroundBlur()
  }

  // Converges the processor and the peer's video on the selected level and the current
  // camera. Each call supersedes the ones still loading, so the last call decides.
  private syncBackgroundBlur(): Promise<void> {
    this.blurSync = this.runBlurSync()
    return this.blurSync
  }

  private async runBlurSync(): Promise<void> {
    const request = ++this.blurRequest
    const level = useCallStore.getState().backgroundBlur
    if (level === "off") {
      await this.switchBlur(null)
      return
    }
    if (this.blur) {
      this.blur.level = level
      await this.switchBlur(this.blur)
      return
    }
    const camera = this.stream?.getVideoTracks()[0]
    if (!camera) return // init() is still running and applies the saved level itself
    if (!isBackgroundBlurSupported()) {
      useCallStore.setState({ backgroundBlur: "off" })
      return
    }
    let processor: BackgroundBlurProcessor
    try {
      processor = await BackgroundBlurProcessor.create(camera, level, (broken) =>
        this.handleBrokenBlur(broken)
      )
    } catch (err) {
      if (request !== this.blurRequest) return
      console.error("[BackgroundBlur] failed to start", err)
      this.reportBlurFailure()
      return
    }
    if (request !== this.blurRequest) {
      processor.stop()
      return
    }
    processor.setEnabled(camera.enabled)
    await this.switchBlur(processor)
  }

  // Shows `next` to the peer and in the self preview, then stops the processor it replaces.
  private async switchBlur(next: BackgroundBlurProcessor | null): Promise<void> {
    const previous = this.blur
    if (previous !== next) {
      this.blur = next
      useCallStore.setState({ localPreviewStream: next ? new MediaStream([next.track]) : null })
    }
    const sent = await this.sendCurrentCameraTrack()
    if (previous !== next) previous?.stop()
    if (sent || !next || this.blur !== next) return
    // The peer kept the raw camera, so the blurred preview would misrepresent what it sees.
    this.reportBlurFailure()
    await this.syncBackgroundBlur()
  }

  private handleBrokenBlur(broken: BackgroundBlurProcessor): void {
    if (broken !== this.blur) return
    this.reportBlurFailure()
    void this.syncBackgroundBlur()
  }

  // Every blur failure turns the camera off, so the peer never receives the unblurred
  // camera unless the user turns it back on.
  private reportBlurFailure(): void {
    const camera = this.stream?.getVideoTracks()[0]
    if (camera) camera.enabled = false
    this.blur?.setEnabled(false)
    useCallStore.setState({
      backgroundBlur: "off",
      isCameraOff: true,
      notice: { kind: "error", messageKey: "room.toast.backgroundBlurFailed" },
    })
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
    const blurLevel = useCallStore.getState().backgroundBlur
    let nextBlur: BackgroundBlurProcessor | null = null
    if (kind === "cam" && blurLevel !== "off") {
      try {
        nextBlur = await BackgroundBlurProcessor.create(newTrack, blurLevel, (broken) =>
          this.handleBrokenBlur(broken)
        )
      } catch (err) {
        console.error("[BackgroundBlur] failed to restart on new camera", err)
        this.reportBlurFailure()
      }
    }
    const discardNewCamera = () => {
      nextBlur?.stop()
      freshStream.getTracks().forEach((track) => track.stop())
    }
    if (!this.pc || !this.stream) {
      discardNewCamera() // the call ended while the camera or blur was loading
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
    nextBlur?.setEnabled(newTrack.enabled)

    const isSharing = useCallStore.getState().isScreenSharing
    const skipSenderSwap = kind === "cam" && isSharing
    const sender = this.pc.getSenders().find((candidate) => candidate.track?.kind === trackKind)

    if (!skipSenderSwap && sender) {
      try {
        await sender.replaceTrack(nextBlur?.track ?? newTrack)
      } catch (err) {
        discardNewCamera()
        throw err
      }
    }
    if (!this.stream) {
      discardNewCamera() // the call ended during the sender swap
      return
    }

    if (oldTrack) {
      newTrack.enabled = oldTrack.enabled // the camera may have been toggled during the swap
      this.stream.removeTrack(oldTrack)
      oldTrack.stop()
    }
    this.stream.addTrack(newTrack)
    if (kind === "mic") return

    nextBlur?.setEnabled(newTrack.enabled)
    const previousBlur = this.blur
    this.blur = nextBlur
    useCallStore.setState({
      localPreviewStream: nextBlur ? new MediaStream([nextBlur.track]) : null,
    })
    previousBlur?.stop()
    // Blur may have changed level or been toggled while the new camera loaded.
    await this.syncBackgroundBlur()
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
    let cameraTrack: MediaStreamTrack | null = null
    try {
      if (!this.pc) return
      cameraTrack = this.outgoingCameraTrack()
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
    // Blur may have started or stopped while the camera was being restored.
    if (this.outgoingCameraTrack() !== cameraTrack) await this.sendCurrentCameraTrack()
  }

  teardown() {
    if (this.pc) {
      const videoSender = this.pc.getSenders().find((s) => s.track?.kind === "video")
      const screenVideoTrack = videoSender?.track ?? null
      const cameraVideoTrack = this.outgoingCameraTrack()
      if (screenVideoTrack && screenVideoTrack !== cameraVideoTrack) {
        screenVideoTrack.stop()
      }
    }
    const screenAudioTrack = this.screenAudioTransceiver?.sender.track ?? null
    screenAudioTrack?.stop()
    this.blurRequest++
    this.blur?.stop()
    this.blur = null

    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.pc = null
    this.screenAudioTransceiver = null
    useCallStore.setState({
      screenShareSurface: null,
      isScreenSharing: false,
      localPreviewStream: null,
    })
  }
}

function toScreenShareSurface(value: string | undefined): ScreenShareSurface {
  if (value === "browser" || value === "window" || value === "monitor") {
    return value
  }
  return null
}
