import { MoreVertical } from "lucide-react"
import { useTranslation } from "react-i18next"
import { GlassMenu } from "./GlassMenu"

export type SettingsItem = { id: string; label: string; onSelect: () => void }

export function SettingsMenu() {
  const { t } = useTranslation()
  const items: SettingsItem[] = []

  return (
    <GlassMenu
      trigger={
        <button
          type="button"
          aria-label={t("room.settings.open")}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/30 text-white transition hover:bg-white/45"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      }
      sections={[
        {
          label: t("room.settings.section"),
          selectedId: "",
          onSelect: (id: string) => {
            items.find((item) => item.id === id)?.onSelect()
          },
          items:
            items.length > 0
              ? items
              : [{ id: "__placeholder__", label: t("room.settings.empty"), disabled: true }],
        },
      ]}
    />
  )
}
