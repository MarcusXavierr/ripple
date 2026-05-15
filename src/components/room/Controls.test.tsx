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
          "room.controls.hideControls": "Zen mode",
          "room.controls.showControls": "Show controls",
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
    collapsed: false,
    onToggleCollapsed: vi.fn(),
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

  it("bar uses .glass-bar utility (16px backdrop blur token)", () => {
    renderControls()

    expect(screen.getByTestId("controls-bar").className).toContain("glass-bar")
  })

  it("child buttons use bg-white/40 (light glass on docked bar)", () => {
    renderControls()

    expect(screen.getByRole("button", { name: "Share screen" }).className).toContain("bg-white/40")
  })

  it("collapse tab calls onToggleCollapsed", async () => {
    const user = userEvent.setup()
    const props = renderControls()

    await user.click(screen.getByTestId("controls-collapse-tab"))

    expect(props.onToggleCollapsed).toHaveBeenCalled()
  })

  it("collapsing the bar shrinks max-height to 0", () => {
    renderControls({ collapsed: true })
    const bar = screen.getByTestId("controls-bar")

    expect(bar.style.maxHeight).toBe("0px")
  })

  it("marks the dock as full-width compact on mobile while preserving desktop centering", () => {
    renderControls()

    const dock = screen.getByTestId("controls-dock")
    const bar = screen.getByTestId("controls-bar")

    expect(dock.className).toContain("left-0")
    expect(dock.className).toContain("right-0")
    expect(dock.className).toContain("px-2")
    expect(dock.className).toContain("bottom-[max(0.5rem,env(safe-area-inset-bottom))]")
    expect(dock.className).toContain("sm:bottom-0")
    expect(dock.className).toContain("sm:left-1/2")
    expect(dock.className).toContain("sm:right-auto")
    expect(dock.className).toContain("sm:px-0")
    expect(bar.className).toContain("w-full")
    expect(bar.className).toContain("justify-between")
    expect(bar.className).toContain("sm:w-auto")
    expect(bar.className).toContain("sm:justify-start")
  })

  it("hides the settings cluster below 370px and shows it from 370px up", () => {
    renderControls()

    const settingsCluster = screen.getByTestId("settings-cluster")

    expect(settingsCluster.className).toContain("hidden")
    expect(settingsCluster.className).toContain("min-[370px]:flex")
    expect(screen.getByRole("button", { name: "Open settings" })).toBeInTheDocument()
  })

  it("keeps action names accessible while hiding long labels visually on mobile", () => {
    renderControls()

    expect(screen.getByRole("button", { name: "Share screen" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Leave call" })).toBeInTheDocument()
    expect(screen.getByTestId("share-screen-label").className).toContain("sr-only")
    expect(screen.getByTestId("share-screen-label").className).toContain("sm:not-sr-only")
    expect(screen.getByTestId("hangup-label").className).toContain("sr-only")
    expect(screen.getByTestId("hangup-label").className).toContain("sm:not-sr-only")
  })

  it("keeps the collapse tab touch target usable while preserving a compact visual tab", () => {
    renderControls()

    const collapseTab = screen.getByTestId("controls-collapse-tab")
    const collapseSurface = screen.getByTestId("controls-collapse-tab-surface")

    expect(collapseTab.className).toContain("h-11")
    expect(collapseTab.className).toContain("w-12")
    expect(collapseSurface.className).toContain("h-[22px]")
    expect(collapseSurface.className).toContain("w-12")
  })
})
