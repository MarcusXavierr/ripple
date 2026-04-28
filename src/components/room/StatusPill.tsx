import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "@/components/ui/toast"
import type { CallStatus } from "@/store/call"

export type StatusPillProps = { roomId: string; status: CallStatus }

function getStatusLabel(
  status: CallStatus,
  t: (key: string, options?: Record<string, string>) => string
) {
  return {
    idle: t("room.status.idle"),
    connecting: t("room.status.connecting"),
    waiting: t("room.status.waiting"),
    negotiating: t("room.status.negotiating"),
    connected: t("room.status.connected"),
    reconnecting: t("room.status.reconnecting"),
    disconnected: t("room.status.disconnected"),
    ended: t("room.status.ended"),
  }[status]
}

function getDotClassName(status: CallStatus): string {
  if (status === "connected") return "bg-emerald-400"
  if (
    status === "connecting" ||
    status === "waiting" ||
    status === "negotiating" ||
    status === "reconnecting"
  ) {
    return "bg-amber-400"
  }
  return "bg-rose-400"
}

function formatMmSs(ms: number): string {
  const total = Math.floor(ms / 1000)
  const minutes = String(Math.floor(total / 60)).padStart(2, "0")
  const seconds = String(total % 60).padStart(2, "0")
  return `${minutes}:${seconds}`
}

export function StatusPill({ roomId, status }: StatusPillProps) {
  const { t } = useTranslation()
  const connectedAtRef = useRef<number | null>(null)
  const accumulatedMsRef = useRef(0)
  const [tick, setTick] = useState(0)
  const [hasEverConnected, setHasEverConnected] = useState(false)

  useEffect(() => {
    if (status === "connected") {
      if (connectedAtRef.current === null) {
        connectedAtRef.current = Date.now()
      }
      setHasEverConnected(true)
      return
    }

    if (connectedAtRef.current !== null) {
      accumulatedMsRef.current += Date.now() - connectedAtRef.current
      connectedAtRef.current = null
      setTick((value) => value + 1)
    }
  }, [status])

  useEffect(() => {
    if (status !== "connected") return
    const interval = window.setInterval(() => {
      setTick((value) => value + 1)
    }, 1000)
    return () => {
      window.clearInterval(interval)
    }
  }, [status])

  const elapsedMs =
    accumulatedMsRef.current + (connectedAtRef.current ? Date.now() - connectedAtRef.current : 0)

  async function handleCopyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`)
    toast(t("room.toast.linkCopied"), "success")
  }

  return (
    <button
      type="button"
      onClick={() => {
        void handleCopyLink()
      }}
      aria-label={t("room.status.copyLinkAria", { status: getStatusLabel(status, t), roomId })}
      className="glass-dark absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-1.5 text-sm text-white"
      data-testid="status-pill"
      data-tick={tick}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full animate-[ripple-pulse_1.6s_infinite] ${getDotClassName(status)}`}
      />
      <span>{getStatusLabel(status, t)}</span>
      <span aria-hidden="true">·</span>
      <span className="font-mono">{roomId}</span>
      {hasEverConnected ? (
        <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 font-mono tabular-nums">
          {formatMmSs(elapsedMs)}
        </span>
      ) : null}
    </button>
  )
}
