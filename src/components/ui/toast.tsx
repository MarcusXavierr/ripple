import { CheckCircle2, Info, AlertTriangle, XCircle } from "lucide-react"
import { type JSX, useEffect, useMemo, useRef, useState } from "react"

export type ToastVariant = "info" | "success" | "warning" | "error"
export type ToastInput = { message: string; variant?: ToastVariant; duration?: number }
export type ToastRecord = {
  id: string
  message: string
  variant: ToastVariant
  duration: number
  createdAt: number
}

type ToastEvent = { type: "add"; toast: ToastRecord } | { type: "dismiss"; id: string }

const TOAST_LEAVE_DURATION_MS = 280
export const DEFAULT_TOAST_DURATION = 4000

const listeners = new Set<(event: ToastEvent) => void>()
let warnedAboutMultipleSubscribers = false
let toastContainerCount = 0
let warnedAboutMultipleContainers = false

function emit(event: ToastEvent) {
  for (const listener of listeners) {
    listener(event)
  }
}

function normalizeToastInput(
  input: ToastInput | string,
  variant?: ToastVariant,
  duration?: number,
): Omit<ToastRecord, "id" | "createdAt"> {
  if (typeof input === "string") {
    return {
      message: input,
      variant: variant ?? "info",
      duration: duration ?? DEFAULT_TOAST_DURATION,
    }
  }

  return {
    message: input.message,
    variant: input.variant ?? "info",
    duration: input.duration ?? DEFAULT_TOAST_DURATION,
  }
}

export function toast(input: ToastInput | string, variant?: ToastVariant, duration?: number): string {
  const next = normalizeToastInput(input, variant, duration)
  const id = crypto.randomUUID()
  emit({
    type: "add",
    toast: {
      id,
      createdAt: Date.now(),
      ...next,
    },
  })
  return id
}

export function dismissToast(id: string): void {
  emit({ type: "dismiss", id })
}

export function subscribeToasts(listener: (event: ToastEvent) => void): () => void {
  if (import.meta.env.DEV && listeners.size > 0 && !warnedAboutMultipleSubscribers) {
    warnedAboutMultipleSubscribers = true
    console.warn("[toast] multiple subscribers mounted")
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getVariantMeta(variant: ToastVariant) {
  switch (variant) {
    case "success":
      return {
        label: "Success",
        stripeClassName: "bg-emerald-500",
        live: "polite" as const,
        role: "status" as const,
        Icon: CheckCircle2,
        iconTestId: "toast-icon-success",
      }
    case "warning":
      return {
        label: "Warning",
        stripeClassName: "bg-amber-500",
        live: "assertive" as const,
        role: "alert" as const,
        Icon: AlertTriangle,
        iconTestId: "toast-icon-warning",
      }
    case "error":
      return {
        label: "Error",
        stripeClassName: "bg-rose-500",
        live: "assertive" as const,
        role: "alert" as const,
        Icon: XCircle,
        iconTestId: "toast-icon-error",
      }
    case "info":
    default:
      return {
        label: "Info",
        stripeClassName: "bg-blue-500",
        live: "polite" as const,
        role: "status" as const,
        Icon: Info,
        iconTestId: "toast-icon-info",
      }
  }
}

export function Toast({ record, onDismiss }: { record: ToastRecord; onDismiss: (id: string) => void }): JSX.Element {
  const [isLeaving, setIsLeaving] = useState(false)
  const leaveTimerRef = useRef<number | null>(null)
  const meta = useMemo(() => getVariantMeta(record.variant), [record.variant])

  useEffect(() => {
    return () => {
      if (leaveTimerRef.current !== null) {
        window.clearTimeout(leaveTimerRef.current)
      }
    }
  }, [])

  function handleDismiss() {
    if (isLeaving) return
    setIsLeaving(true)
    leaveTimerRef.current = window.setTimeout(() => {
      onDismiss(record.id)
    }, TOAST_LEAVE_DURATION_MS)
  }

  return (
    <button
      type="button"
      onClick={handleDismiss}
      role={meta.role}
      aria-live={meta.live}
      className={[
        "glass-strong relative w-full overflow-hidden rounded-2xl pl-0 text-left shadow-xl",
        "animate-[toast-in_280ms_ease-out] text-slate-950",
        isLeaving ? "animate-[toast-out_280ms_ease-in_forwards]" : "",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        data-testid={`toast-stripe-${record.variant}`}
        className={`absolute inset-y-0 left-0 w-1 ${meta.stripeClassName}`}
      />
      <div className="flex items-start gap-3 px-4 py-3">
        <meta.Icon
          data-testid={meta.iconTestId}
          className="mt-0.5 h-5 w-5 shrink-0 text-slate-700"
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{meta.label}</div>
          <div className="text-sm text-slate-700">{record.message}</div>
        </div>
      </div>
      <span
        aria-hidden="true"
        data-testid={`toast-progress-${record.id}`}
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-black/12 animate-[toast-progress_linear_forwards]"
        style={{ animationDuration: `${record.duration}ms` }}
      />
    </button>
  )
}

export function useToasts(): { toasts: ToastRecord[]; dismiss: (id: string) => void } {
  const [toastMap, setToastMap] = useState<Map<string, ToastRecord>>(() => new Map())
  const timeoutIdsRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    return subscribeToasts((event) => {
      if (event.type === "add") {
        setToastMap((current) => {
          const next = new Map(current)
          next.set(event.toast.id, event.toast)
          return next
        })
        const timeoutId = window.setTimeout(() => {
          dismissToast(event.toast.id)
        }, event.toast.duration)
        timeoutIdsRef.current.set(event.toast.id, timeoutId)
        return
      }

      const timeoutId = timeoutIdsRef.current.get(event.id)
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
        timeoutIdsRef.current.delete(event.id)
      }
      setToastMap((current) => {
        if (!current.has(event.id)) return current
        const next = new Map(current)
        next.delete(event.id)
        return next
      })
    })
  }, [])

  useEffect(() => {
    return () => {
      for (const timeoutId of timeoutIdsRef.current.values()) {
        window.clearTimeout(timeoutId)
      }
      timeoutIdsRef.current.clear()
    }
  }, [])

  function dismiss(id: string) {
    dismissToast(id)
  }

  return {
    toasts: Array.from(toastMap.values()).sort((a, b) => a.createdAt - b.createdAt),
    dismiss,
  }
}

export function ToastContainer(): JSX.Element {
  const { toasts, dismiss } = useToasts()

  useEffect(() => {
    toastContainerCount += 1
    if (import.meta.env.DEV && toastContainerCount > 1 && !warnedAboutMultipleContainers) {
      warnedAboutMultipleContainers = true
      console.warn("[toast] multiple ToastContainer instances mounted")
    }
    return () => {
      toastContainerCount -= 1
    }
  }, [])

  return (
    <div className="pointer-events-none fixed top-6 right-6 z-[100] flex flex-col gap-2.5">
      {toasts.map((record) => (
        <div key={record.id} className="pointer-events-auto w-[min(22rem,calc(100vw-3rem))]">
          <Toast record={record} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  )
}
