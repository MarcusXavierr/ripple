import { useCallStore } from "@/store/call"

export class MediaController {
  private stream: MediaStream | null = null
  private pc: RTCPeerConnection | null = null

  async init(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    this.stream = stream
    return stream
  }

  attachPC(pc: RTCPeerConnection) {
    this.pc = pc
    const stream = this.stream
    if (stream) stream.getTracks().forEach((t) => pc.addTrack(t, stream))
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
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      const screenTrack = screenStream.getVideoTracks()[0]
      const sender = this.pc.getSenders().find((s) => s.track?.kind === "video")
      if (sender) {
        await sender.replaceTrack(screenTrack)
      } else {
        this.pc.addTrack(screenTrack, screenStream)
      }
      useCallStore.setState({ isScreenSharing: true })
      screenTrack.onended = () => {
        void this.stopScreenShare()
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") return
      console.error("[Screenshare] failed to start", err)
      useCallStore.setState({ error: "Could not start screen share." })
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
    } catch (err) {
      console.error("[Screenshare] failed to stop", err)
    } finally {
      useCallStore.setState({ isScreenSharing: false })
    }
  }

  teardown() {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.pc = null
  }
}
