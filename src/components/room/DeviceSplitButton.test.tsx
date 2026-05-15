import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Mic, MicOff, Video, VideoOff } from "lucide-react"
import { describe, expect, it, vi } from "vitest"
import { DeviceSplitButton } from "./DeviceSplitButton"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "room.devices.micSection": "Microphone",
        "room.devices.speakerSection": "Speaker",
        "room.devices.cameraSection": "Camera",
        "room.devices.allowAccess": "Allow microphone/camera access",
        "room.devices.openMicMenu": "Choose microphone or speaker",
        "room.devices.openCameraMenu": "Choose camera",
      })[key] ?? key,
  }),
}))

function renderMicButton(props?: Partial<React.ComponentProps<typeof DeviceSplitButton>>) {
  const onToggle = vi.fn()
  const onSelectDevice = vi.fn()
  const onSelectSpeaker = vi.fn()
  const onRequestPermission = vi.fn()

  render(
    <DeviceSplitButton
      kind="mic"
      active
      onToggle={onToggle}
      Icon={Mic}
      IconOff={MicOff}
      devices={[
        { id: "mic-1", label: "Mic 1" },
        { id: "mic-2", label: "Mic 2" },
      ]}
      selectedDeviceId="mic-1"
      onSelectDevice={onSelectDevice}
      speakerDevices={[{ id: "speaker-1", label: "Speaker 1" }]}
      selectedSpeakerId="speaker-1"
      onSelectSpeaker={onSelectSpeaker}
      speakerSupported
      permissionGranted
      onRequestPermission={onRequestPermission}
      label="Mute microphone"
      {...props}
    />
  )

  return { onToggle, onSelectDevice, onSelectSpeaker, onRequestPermission }
}

describe("DeviceSplitButton", () => {
  it("clicking the toggle calls onToggle", async () => {
    const user = userEvent.setup()
    const { onToggle } = renderMicButton()

    await user.click(screen.getByRole("button", { name: "Mute microphone" }))

    expect(onToggle).toHaveBeenCalled()
  })

  it("renders muted icon when active=false", () => {
    renderMicButton({ active: false })

    expect(document.querySelector(".lucide-mic-off")).toBeInTheDocument()
  })

  it("caret opens menu showing the Microphone and Speaker sections", async () => {
    const user = userEvent.setup()
    renderMicButton()

    await user.click(screen.getByRole("button", { name: "Choose microphone or speaker" }))

    expect(screen.getByText("Microphone")).toBeInTheDocument()
    expect(screen.getByText("Speaker")).toBeInTheDocument()
  })

  it("speaker section is hidden when speakerSupported=false", async () => {
    const user = userEvent.setup()
    renderMicButton({ speakerSupported: false })

    await user.click(screen.getByRole("button", { name: "Choose microphone or speaker" }))

    expect(screen.queryByText("Speaker")).not.toBeInTheDocument()
  })

  it("selecting a mic item calls onSelectDevice with that id", async () => {
    const user = userEvent.setup()
    const { onSelectDevice } = renderMicButton()

    await user.click(screen.getByRole("button", { name: "Choose microphone or speaker" }))
    await user.click(screen.getByRole("menuitemradio", { name: "Mic 2" }))

    expect(onSelectDevice).toHaveBeenCalledWith("mic-2")
  })

  it("selecting a speaker item calls onSelectSpeaker", async () => {
    const user = userEvent.setup()
    const { onSelectSpeaker } = renderMicButton()

    await user.click(screen.getByRole("button", { name: "Choose microphone or speaker" }))
    await user.click(screen.getByRole("menuitemradio", { name: "Speaker 1" }))

    expect(onSelectSpeaker).toHaveBeenCalledWith("speaker-1")
  })

  it("shows 'Allow access' single-item menu when permissionGranted=false and triggers onRequestPermission on click", async () => {
    const user = userEvent.setup()
    const { onRequestPermission } = renderMicButton({ permissionGranted: false })

    await user.click(screen.getByRole("button", { name: "Choose microphone or speaker" }))
    await user.click(screen.getByRole("menuitemradio", { name: "Allow microphone/camera access" }))

    expect(onRequestPermission).toHaveBeenCalled()
  })

  it("camera kind has only the Camera section", async () => {
    const user = userEvent.setup()
    render(
      <DeviceSplitButton
        kind="cam"
        active
        onToggle={vi.fn()}
        Icon={Video}
        IconOff={VideoOff}
        devices={[{ id: "cam-1", label: "Cam 1" }]}
        selectedDeviceId="cam-1"
        onSelectDevice={vi.fn()}
        permissionGranted
        onRequestPermission={vi.fn()}
        label="Turn off camera"
      />
    )

    await user.click(screen.getByRole("button", { name: "Choose camera" }))

    expect(screen.getByText("Camera")).toBeInTheDocument()
    expect(screen.queryByText("Speaker")).not.toBeInTheDocument()
  })

  it("keeps mobile split-button hit targets at least 44px and restores the narrower desktop caret at sm", () => {
    renderMicButton()

    const toggle = screen.getByRole("button", { name: "Mute microphone" })
    const menu = screen.getByRole("button", { name: "Choose microphone or speaker" })

    expect(toggle.className).toContain("h-11")
    expect(toggle.className).toContain("w-11")
    expect(menu.className).toContain("h-11")
    expect(menu.className).toContain("w-11")
    expect(menu.className).toContain("sm:w-7")
  })
})
