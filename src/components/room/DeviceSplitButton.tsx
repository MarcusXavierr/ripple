import type { LucideIcon } from "lucide-react"
import { ChevronUp } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { DeviceInfo } from "@/hooks/useDevices"
import { cn } from "@/lib/utils"
import { GlassMenu, type GlassMenuSection } from "./GlassMenu"

export type DeviceSplitButtonProps = {
  kind: "mic" | "cam"
  active: boolean
  onToggle: () => void
  Icon: LucideIcon
  IconOff: LucideIcon
  devices: DeviceInfo[]
  selectedDeviceId: string
  onSelectDevice: (id: string) => void
  speakerDevices?: DeviceInfo[]
  selectedSpeakerId?: string
  onSelectSpeaker?: (id: string) => void
  speakerSupported?: boolean
  permissionGranted: boolean
  onRequestPermission: () => void
  label: string
}

export function DeviceSplitButton({
  kind,
  active,
  onToggle,
  Icon,
  IconOff,
  devices,
  selectedDeviceId,
  onSelectDevice,
  speakerDevices = [],
  selectedSpeakerId = "",
  onSelectSpeaker,
  speakerSupported = false,
  permissionGranted,
  onRequestPermission,
  label,
}: DeviceSplitButtonProps) {
  const { t } = useTranslation()
  const CurrentIcon = active ? Icon : IconOff

  let sections: GlassMenuSection[]

  if (!permissionGranted) {
    sections = [
      {
        label: kind === "mic" ? t("room.devices.micSection") : t("room.devices.cameraSection"),
        selectedId: "",
        onSelect: () => onRequestPermission(),
        items: [{ id: "__request__", label: t("room.devices.allowAccess") }],
      },
    ]
  } else {
    sections = [
      {
        label: kind === "mic" ? t("room.devices.micSection") : t("room.devices.cameraSection"),
        selectedId: selectedDeviceId,
        onSelect: onSelectDevice,
        items: devices,
      },
    ]

    if (kind === "mic" && speakerSupported && onSelectSpeaker) {
      sections.push({
        label: t("room.devices.speakerSection"),
        selectedId: selectedSpeakerId,
        onSelect: onSelectSpeaker,
        items: speakerDevices,
      })
    }
  }

  return (
    <div className="flex items-center rounded-full">
      <button
        type="button"
        aria-label={label}
        onClick={onToggle}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-l-2xl border border-white/50 text-ripple-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition",
          active
            ? "bg-white/40 hover:bg-white/65"
            : "border-transparent bg-rose-500 text-white hover:bg-rose-600"
        )}
      >
        <CurrentIcon className="h-4 w-4" />
      </button>
      <GlassMenu
        trigger={
          <button
            type="button"
            aria-label={
              kind === "mic" ? t("room.devices.openMicMenu") : t("room.devices.openCameraMenu")
            }
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-r-2xl border border-l-0 border-white/50 text-ripple-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition sm:w-7",
              active
                ? "bg-white/40 hover:bg-white/65"
                : "border-transparent bg-rose-500 text-white hover:bg-rose-600"
            )}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        }
        sections={sections}
      />
    </div>
  )
}
