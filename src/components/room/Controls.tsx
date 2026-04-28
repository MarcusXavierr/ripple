import { Mic, MicOff, MonitorUp, PhoneOff, Video, VideoOff } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { DeviceKind, DevicesByKind, SelectedDevices } from "@/hooks/useDevices"
import { DeviceSplitButton } from "./DeviceSplitButton"
import { SettingsMenu } from "./SettingsMenu"

export type ControlsProps = {
  isMicMuted: boolean
  isCameraOff: boolean
  isScreenSharing: boolean
  toggleMic: () => void
  toggleCamera: () => void
  startScreenShare: () => void
  stopScreenShare: () => void
  hangup: () => void
  devices: DevicesByKind
  selected: SelectedDevices
  onSelectDevice: (kind: DeviceKind, id: string) => void
  speakerSupported: boolean
  permissionGranted: boolean
  onRequestPermission: () => void
}

export function Controls({
  isMicMuted,
  isCameraOff,
  isScreenSharing,
  toggleMic,
  toggleCamera,
  startScreenShare,
  stopScreenShare,
  hangup,
  devices,
  selected,
  onSelectDevice,
  speakerSupported,
  permissionGranted,
  onRequestPermission,
}: ControlsProps) {
  const { t } = useTranslation()

  return (
    <div
      data-testid="controls-bar"
      className="glass-bar absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full px-3 py-2"
      style={{ backdropFilter: "blur(16px) saturate(180%)" }}
    >
      <DeviceSplitButton
        kind="mic"
        active={!isMicMuted}
        onToggle={toggleMic}
        Icon={Mic}
        IconOff={MicOff}
        devices={devices.mic}
        selectedDeviceId={selected.mic}
        onSelectDevice={(id) => onSelectDevice("mic", id)}
        speakerDevices={devices.speaker}
        selectedSpeakerId={selected.speaker}
        onSelectSpeaker={(id) => onSelectDevice("speaker", id)}
        speakerSupported={speakerSupported}
        permissionGranted={permissionGranted}
        onRequestPermission={onRequestPermission}
        label={isMicMuted ? t("room.controls.unmute") : t("room.controls.mute")}
      />
      <DeviceSplitButton
        kind="cam"
        active={!isCameraOff}
        onToggle={toggleCamera}
        Icon={Video}
        IconOff={VideoOff}
        devices={devices.cam}
        selectedDeviceId={selected.cam}
        onSelectDevice={(id) => onSelectDevice("cam", id)}
        permissionGranted={permissionGranted}
        onRequestPermission={onRequestPermission}
        label={isCameraOff ? t("room.controls.enableCamera") : t("room.controls.disableCamera")}
      />
      <span className="mx-1 h-6 w-px bg-white/15" aria-hidden="true" />
      <button
        type="button"
        onClick={isScreenSharing ? stopScreenShare : startScreenShare}
        aria-label={
          isScreenSharing ? t("room.controls.stopSharing") : t("room.controls.shareScreen")
        }
        className="flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/30 px-4 py-2 text-sm text-white transition hover:bg-white/45"
      >
        <MonitorUp className="h-4 w-4" />
        <span>
          {isScreenSharing ? t("room.controls.stopSharing") : t("room.controls.shareScreen")}
        </span>
      </button>
      <span className="mx-1 h-6 w-px bg-white/15" aria-hidden="true" />
      <SettingsMenu />
      <span className="mx-1 h-6 w-px bg-white/15" aria-hidden="true" />
      <button
        type="button"
        onClick={hangup}
        aria-label={t("room.controls.hangUp")}
        className="flex h-11 items-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-sm text-white transition hover:bg-rose-600"
      >
        <PhoneOff className="h-4 w-4" />
        <span>{t("room.controls.hangUp")}</span>
      </button>
    </div>
  )
}
