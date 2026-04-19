import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"

export default function CallEnded() {
  const { id: roomId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background">
      <h1 className="text-2xl font-semibold">{t("callEnded.title")}</h1>
      <div className="flex gap-3">
        <Button onClick={() => navigate(`/room/${roomId}`)}>{t("callEnded.rejoin")}</Button>
        <Button variant="outline" onClick={() => navigate("/")}>
          {t("callEnded.returnHome")}
        </Button>
      </div>
    </main>
  )
}
