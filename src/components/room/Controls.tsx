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
      className="absolute right-0 bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-0 z-20 flex flex-col items-center px-2 sm:bottom-0 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:px-0"
    >
      <button
        type="button"
        data-testid="controls-collapse-tab"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? t("room.controls.showControls") : t("room.controls.hideControls")}
        className="flex h-11 w-12 items-end justify-center text-ripple-ink transition-opacity"
      >
        <span
          data-testid="controls-collapse-tab-surface"
          className="flex h-[22px] w-12 items-center justify-center rounded-t-lg"
          style={{
            background: "rgba(255, 255, 255, 0.4)",
            backdropFilter: "blur(16px) saturate(180%)",
            WebkitBackdropFilter: "blur(16px) saturate(180%)",
            borderTop: "1px solid rgba(255, 255, 255, 0.5)",
            borderLeft: "1px solid rgba(255, 255, 255, 0.5)",
            borderRight: "1px solid rgba(255, 255, 255, 0.5)",
            borderBottom: "none",
            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 -2px 8px rgba(0, 0, 0, 0.10)",
            opacity: collapsed ? 0.7 : 1,
          }}
        >
          <ChevronUp
            className="h-3.5 w-3.5 transition-transform"
            style={{ transform: collapsed ? "rotate(180deg)" : "none" }}
          />
        </span>
      </button>
      <div
        data-testid="controls-bar"
        className={`glass-bar flex w-full items-center justify-between gap-1 overflow-hidden rounded-t-2xl rounded-b-none transition-[max-height,padding] duration-300 sm:w-auto sm:justify-start sm:gap-2 sm:rounded-t-3xl ${
          collapsed ? "px-2 py-0 sm:px-3" : "px-2 py-2 sm:px-3 sm:py-2.5"
        }`}
        style={{
          maxHeight: collapsed ? 0 : 200,
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
          className="flex h-11 min-w-11 items-center justify-center gap-0 rounded-2xl border border-white/50 bg-white/40 px-3 py-2 text-sm font-medium text-ripple-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition hover:bg-white/65 sm:gap-2 sm:px-4"
        >
          <MonitorUp className="h-5 w-5" />
          <span data-testid="share-screen-label" className="sr-only sm:not-sr-only">
            {isScreenSharing ? t("room.controls.stopSharing") : t("room.controls.shareScreen")}
          </span>
        </button>
        <div data-testid="settings-cluster" className="hidden items-center gap-2 min-[370px]:flex">
          <span className="mx-1 hidden h-6 w-px bg-black/10 sm:inline-block" aria-hidden="true" />
          <SettingsMenu />
          <span className="mx-1 hidden h-6 w-px bg-black/10 sm:inline-block" aria-hidden="true" />
        </div>
        <button
          type="button"
          onClick={hangup}
          aria-label={t("room.controls.hangUp")}
          className="flex h-11 min-w-11 items-center justify-center gap-0 rounded-2xl bg-rose-500 px-3 py-2 text-sm font-medium text-white shadow-[0_4px_14px_rgba(239,68,68,0.4),inset_0_1px_0_rgba(255,255,255,0.25)] transition hover:bg-rose-600 sm:gap-2 sm:px-5"
        >
          <PhoneOff className="h-5 w-5" />
          <span data-testid="hangup-label" className="sr-only sm:not-sr-only">
            {t("room.controls.hangUp")}
          </span>
        </button>
      </div>
    </div>
  )
}
