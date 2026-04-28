import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"
import { Controls } from "./Controls"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          "room.controls.unmute": "Unmute microphone",
          "room.controls.mute": "Mute microphone",
          "room.controls.enableCamera": "Turn on camera",
          "room.controls.disableCamera": "Turn off camera",
          "room.controls.stopSharing": "Stop sharing",
          "room.controls.shareScreen": "Share screen",
          "room.controls.hangUp": "Leave call",
          "room.settings.open": "Open settings",
          "room.settings.section": "Settings",
          "room.settings.empty": "No settings yet",
          "room.devices.micSection": "Microphone",
          "room.devices.speakerSection": "Speaker",
          "room.devices.cameraSection": "Camera",
          "room.devices.allowAccess": "Allow microphone/camera access",
          "room.devices.openMicMenu": "Choose microphone or speaker",
          "room.devices.openCameraMenu": "Choose camera",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}))

function renderControls(props?: Partial<ComponentProps<typeof Controls>>) {
  const baseProps: ComponentProps<typeof Controls> = {
    isMicMuted: false,
    isCameraOff: false,
    isScreenSharing: false,
    toggleMic: vi.fn(),
    toggleCamera: vi.fn(),
    startScreenShare: vi.fn(),
    stopScreenShare: vi.fn(),
    hangup: vi.fn(),
    devices: {
      mic: [{ id: "mic-1", label: "Mic 1" }],
      cam: [{ id: "cam-1", label: "Cam 1" }],
      speaker: [{ id: "speaker-1", label: "Speaker 1" }],
    },
    selected: { mic: "mic-1", cam: "cam-1", speaker: "speaker-1" },
    onSelectDevice: vi.fn(),
    speakerSupported: true,
    permissionGranted: true,
    onRequestPermission: vi.fn(),
  }

  render(<Controls {...baseProps} {...props} />)
  return baseProps
}

describe("Controls", () => {
  it("clicking the mic toggle calls toggleMic", async () => {
    const user = userEvent.setup()
    const props = renderControls()

    await user.click(screen.getByRole("button", { name: "Mute microphone" }))

    expect(props.toggleMic).toHaveBeenCalled()
  })

  it("mic icon reflects isMicMuted", () => {
    renderControls({ isMicMuted: true })

    expect(document.querySelector(".lucide-mic-off")).toBeInTheDocument()
  })

  it("clicking the camera toggle calls toggleCamera", async () => {
    const user = userEvent.setup()
    const props = renderControls()

    await user.click(screen.getByRole("button", { name: "Turn off camera" }))

    expect(props.toggleCamera).toHaveBeenCalled()
  })

  it("camera icon reflects isCameraOff", () => {
    renderControls({ isCameraOff: true })

    expect(document.querySelector(".lucide-video-off")).toBeInTheDocument()
  })

  it("share button calls startScreenShare when not sharing, stopScreenShare when sharing", async () => {
    const user = userEvent.setup()
    const props = renderControls()
    await user.click(screen.getByRole("button", { name: "Share screen" }))
    expect(props.startScreenShare).toHaveBeenCalled()

    renderControls({ isScreenSharing: true, stopScreenShare: props.stopScreenShare })
    await user.click(screen.getAllByRole("button", { name: "Stop sharing" })[0])
    expect(props.stopScreenShare).toHaveBeenCalled()
  })

  it("leave button calls hangup", async () => {
    const user = userEvent.setup()
    const props = renderControls()

    await user.click(screen.getByRole("button", { name: "Leave call" }))

    expect(props.hangup).toHaveBeenCalled()
  })

  it("bar uses glass-bar (16px blur) class, not glass-dark (20px)", () => {
    renderControls()
    const bar = screen.getByTestId("controls-bar")

    expect(bar.className).toContain("glass-bar")
    expect(bar.className).not.toContain("glass-dark")
  })

  it("resolved backdrop-filter on the bar contains 'blur(16px)'", () => {
    renderControls()

    expect(getComputedStyle(screen.getByTestId("controls-bar")).backdropFilter).toContain(
      "blur(16px)"
    )
  })

  it("child buttons use bg-white/30", () => {
    renderControls()

    expect(screen.getByRole("button", { name: "Share screen" }).className).toContain("bg-white/30")
  })
})
