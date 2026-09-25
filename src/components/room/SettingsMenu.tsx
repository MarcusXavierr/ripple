import { MoreVertical } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { BackgroundBlurLevel } from "@/store/call"
import { GlassMenu } from "./GlassMenu"

const BLUR_LEVELS: readonly BackgroundBlurLevel[] = ["off", "light", "strong"]

export type SettingsMenuProps = {
  backgroundBlur: BackgroundBlurLevel
  backgroundBlurSupported: boolean
  onBackgroundBlurChange: (level: BackgroundBlurLevel) => void
}

export function SettingsMenu({
  backgroundBlur,
  backgroundBlurSupported,
  onBackgroundBlurChange,
}: SettingsMenuProps) {
  const { t } = useTranslation()
  const items = backgroundBlurSupported
    ? BLUR_LEVELS.map((level) => ({
        id: level,
        label: t(`room.settings.backgroundBlur.${level}`),
      }))
    : [{ id: "unsupported", label: t("room.settings.backgroundBlur.unsupported"), disabled: true }]
  return (
    <GlassMenu
      trigger={
        <button
          type="button"
          aria-label={t("room.settings.open")}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/50 bg-white/40 text-ripple-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition hover:bg-white/65"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      }
      sections={[
        {
          label: t("room.settings.backgroundBlur.section"),
          selectedId: backgroundBlur,
          items,
          onSelect: (id: string) => {
            const level = BLUR_LEVELS.find((candidate) => candidate === id)
            if (level) onBackgroundBlurChange(level)
          },
        },
      ]}
    />
  )
}
