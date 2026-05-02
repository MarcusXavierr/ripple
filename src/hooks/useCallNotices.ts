import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "@/components/ui/toast"
import { useCallStore } from "@/store/call"

export function useCallNotices() {
  const notice = useCallStore((s) => s.notice)
  const { t } = useTranslation()

  useEffect(() => {
    if (!notice) return
    toast(t(notice.messageKey), notice.kind)
    useCallStore.setState({ notice: null })
  }, [notice, t])
}
