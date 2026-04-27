import { Check, Settings } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { ScreenSharePreset } from "@/lib/call/mediaProfile"
import { cn } from "@/lib/utils"
import { useCallStore } from "@/store/call"

type Props = {
  onApplyScreenSharePreset: (preset: ScreenSharePreset) => void
}

const PRESET_OPTIONS: ScreenSharePreset[] = ["auto", "video", "text"]

export function CallSettingsButton({ onApplyScreenSharePreset }: Props) {
  const { t } = useTranslation()
  const preset = useCallStore((s) => s.screenSharePreset)
  const setPreset = useCallStore((s) => s.setScreenSharePreset)
  const isScreenSharing = useCallStore((s) => s.isScreenSharing)

  const handleChange = (next: string) => {
    const value = next as ScreenSharePreset
    setPreset(value)
    if (isScreenSharing) onApplyScreenSharePreset(value)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={t("room.controls.settings")}
          title={t("room.controls.settings")}
          className="h-11 w-11"
        >
          <Settings />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={8} className="w-72">
        <div className="space-y-3">
          <p className="font-medium text-sm">{t("room.settings.screenShareQuality.title")}</p>
          <RadioGroup value={preset} onValueChange={handleChange} className="gap-1">
            {PRESET_OPTIONS.map((option) => {
              const active = preset === option
              return (
                <label
                  key={option}
                  htmlFor={`preset-${option}`}
                  className={cn(
                    "flex items-start gap-3 rounded-md p-2 cursor-pointer transition-colors min-h-11",
                    active ? "bg-accent" : "hover:bg-accent/50"
                  )}
                >
                  <RadioGroupItem id={`preset-${option}`} value={option} className="mt-1" />
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">
                      {t(`room.settings.screenShareQuality.${option}`)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t(`room.settings.screenShareQuality.${option}Description`)}
                    </span>
                  </div>
                  {active ? <Check className="mt-1 size-4 text-foreground" aria-hidden /> : null}
                </label>
              )
            })}
          </RadioGroup>
          <p className="text-xs text-muted-foreground">
            {isScreenSharing
              ? t("room.settings.screenShareQuality.helperLive")
              : t("room.settings.screenShareQuality.helperPending")}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
