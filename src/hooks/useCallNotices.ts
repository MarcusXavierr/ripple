import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useCallStore } from "@/store/call"

export function useCallNotices() {
  const notice = useCallStore((s) => s.notice)
  const { t } = useTranslation()

  useEffect(() => {
    if (!notice) return
    toast[notice.kind](t(notice.messageKey))
    useCallStore.setState({ notice: null })
  }, [notice, t])
}
