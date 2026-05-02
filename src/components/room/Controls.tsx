import { ChevronUp, Mic, MicOff, MonitorUp, PhoneOff, Video, VideoOff } from "lucide-react"
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
  collapsed: boolean
  onToggleCollapsed: () => void
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
  collapsed,
  onToggleCollapsed,
}: ControlsProps) {
  const { t } = useTranslation()

  return (
    <div
      data-testid="controls-dock"
      className="absolute bottom-0 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center"
    >
      <button
        type="button"
        data-testid="controls-collapse-tab"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? t("room.controls.showControls") : t("room.controls.hideControls")}
        className="flex h-[22px] w-12 items-center justify-center text-ripple-ink-soft transition-opacity"
        style={{
          background: "rgba(255, 255, 255, 0.22)",
          backdropFilter: "blur(16px) saturate(180%)",
          WebkitBackdropFilter: "blur(16px) saturate(180%)",
          borderTop: "1px solid rgba(255, 255, 255, 0.3)",
          borderLeft: "1px solid rgba(255, 255, 255, 0.3)",
          borderRight: "1px solid rgba(255, 255, 255, 0.3)",
          borderBottom: "none",
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          boxShadow: "0 -2px 8px rgba(0, 0, 0, 0.10)",
          opacity: collapsed ? 0.7 : 1,
        }}
      >
        <ChevronUp
          className="h-3.5 w-3.5 transition-transform"
          style={{ transform: collapsed ? "rotate(180deg)" : "none" }}
        />
      </button>
      <div
        data-testid="controls-bar"
        className="glass-bar flex items-center gap-2 overflow-hidden rounded-t-3xl rounded-b-none transition-[max-height,padding] duration-300"
        style={{
          maxHeight: collapsed ? 0 : 200,
          padding: collapsed ? "0 12px" : "10px 12px",
        }}
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
        <span className="mx-1 h-6 w-px bg-black/10" aria-hidden="true" />
        <button
          type="button"
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
          aria-label={
            isScreenSharing ? t("room.controls.stopSharing") : t("room.controls.shareScreen")
          }
          className="flex h-11 items-center gap-2 rounded-2xl border border-white/50 bg-white/40 px-4 py-2 text-sm font-medium text-ripple-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition hover:bg-white/65"
        >
          <MonitorUp className="h-5 w-5" />
          <span>
            {isScreenSharing ? t("room.controls.stopSharing") : t("room.controls.shareScreen")}
          </span>
        </button>
        <span className="mx-1 h-6 w-px bg-black/10" aria-hidden="true" />
        <SettingsMenu />
        <span className="mx-1 h-6 w-px bg-black/10" aria-hidden="true" />
        <button
          type="button"
          onClick={hangup}
          aria-label={t("room.controls.hangUp")}
          className="flex h-11 items-center gap-2 rounded-2xl bg-rose-500 px-5 py-2 text-sm font-medium text-white shadow-[0_4px_14px_rgba(239,68,68,0.4),inset_0_1px_0_rgba(255,255,255,0.25)] transition hover:bg-rose-600"
        >
          <PhoneOff className="h-5 w-5" />
          <span>{t("room.controls.hangUp")}</span>
        </button>
      </div>
    </div>
  )
}
