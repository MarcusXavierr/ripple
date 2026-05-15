import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "@/components/ui/toast"
import type { CallStatus } from "@/store/call"

export type StatusPillProps = { roomId: string; status: CallStatus; hidden?: boolean }

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

export function StatusPill({ roomId, status, hidden = false }: StatusPillProps) {
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
      className={`glass absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 left-3 flex min-w-0 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-ripple-ink transition-all duration-300 sm:top-3 sm:right-auto sm:left-1/2 sm:gap-2 sm:px-4 sm:text-sm ${
        hidden
          ? "pointer-events-none -translate-y-3 opacity-0 sm:-translate-x-1/2"
          : "translate-y-0 opacity-100 sm:-translate-x-1/2"
      }`}
      data-testid="status-pill"
      data-hidden={hidden ? "true" : "false"}
      data-tick={tick}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full animate-[ripple-pulse_1.6s_infinite] ${getDotClassName(status)}`}
      />
      <span className="shrink-0">{getStatusLabel(status, t)}</span>
      <span aria-hidden="true">·</span>
      <span data-testid="status-pill-room-id" className="min-w-0 truncate font-mono">
        {roomId}
      </span>
      {hasEverConnected ? (
        <span className="ml-1 hidden shrink-0 rounded-full bg-black/5 px-2 py-0.5 font-mono tabular-nums min-[380px]:inline-flex sm:ml-2">
          {formatMmSs(elapsedMs)}
        </span>
      ) : null}
    </button>
  )
}
