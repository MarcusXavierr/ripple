import { type MessageKey, t } from "../i18n/t"
import type { PopupState } from "./derivePopupState"

type PopupViewProps = {
  state: PopupState
  onArm: () => void
  onDisarm: () => void
}

type CardState =
  | { kind: "empty" }
  | { kind: "selected"; title?: string; origin: string }
  | { kind: "selected-is-current"; title?: string; origin: string; statusKey: MessageKey }
  | {
      kind: "stale-closed"
      title?: string
      origin: string
      statusKey: MessageKey
      staleReasonKey: MessageKey
    }
  | {
      kind: "stale-incompatible"
      title?: string
      origin: string
      statusKey: MessageKey
      staleReason?: string
    }

type CtaState =
  | { kind: "use-current"; enabled: boolean; labelKey: MessageKey }
  | { kind: "danger"; labelKey: MessageKey }
  | { kind: "success"; labelKey: MessageKey }
  | { kind: "secondary"; labelKey: MessageKey }

export function PopupView({ state, onArm, onDisarm }: PopupViewProps) {
  const view = mapPopupState(state)
  const staleReason =
    view.card.kind === "stale-closed"
      ? t(view.card.staleReasonKey)
      : view.card.kind === "stale-incompatible"
        ? view.card.staleReason
        : undefined

  return (
    <main className="popup">
      <header className="popup-header">
        <img className="ripple-logo" src="/favicon.svg" alt="" width={36} height={36} />
        <div className="popup-title">
          <div className="name">{t("popup_title")}</div>
          <div className="tagline">{t("popup_tagline")}</div>
        </div>
      </header>

      <section className="section">
        <div className="section-label">{t("popup_selected_tab_label")}</div>
        <TabCard card={view.card} />
        <PrimaryCta cta={view.cta} onArm={onArm} onDisarm={onDisarm} />
        {staleReason && <p className="warning-chip">{staleReason}</p>}
      </section>

      {view.showFooterClear && (
        <footer className="popup-footer">
          <button type="button" className="cta-btn secondary" onClick={onDisarm}>
            {t("popup_clear_selected_tab")}
          </button>
        </footer>
      )}
    </main>
  )
}

function mapPopupState(state: PopupState): {
  card: CardState
  cta: CtaState
  showFooterClear: boolean
} {
  switch (state.kind) {
    case "idle":
      return {
        card: { kind: "empty" },
        cta: { kind: "use-current", enabled: true, labelKey: "popup_use_current_tab" },
        showFooterClear: false,
      }
    case "pendingApproval":
      return {
        card: {
          kind: "selected",
          title: state.armed.title,
          origin: state.armed.origin,
        },
        cta: { kind: "danger", labelKey: "popup_grant_access" },
        showFooterClear: false,
      }
    case "controllable":
      return {
        card: {
          kind: "selected-is-current",
          title: state.armed.title,
          origin: state.armed.origin,
          statusKey: "popup_status_selected",
        },
        cta: { kind: "success", labelKey: "popup_stop_controlling" },
        showFooterClear: false,
      }
    case "permissionLost":
      return {
        card: {
          kind: "stale-incompatible",
          title: state.armed.title,
          origin: state.currentOrigin || state.armed.origin,
          statusKey: "popup_status_unavailable",
          staleReason: t("popup_reason_permission_lost", state.currentOrigin || state.armed.origin),
        },
        cta: { kind: "danger", labelKey: "popup_grant_access" },
        showFooterClear: false,
      }
    case "tabClosed":
      return {
        card: {
          kind: "stale-closed",
          title: state.armed.title,
          origin: state.armed.origin,
          statusKey: "popup_status_tab_closed",
          staleReasonKey: "popup_reason_selected_tab_closed",
        },
        cta: { kind: "secondary", labelKey: "popup_clear_selected_tab" },
        showFooterClear: false,
      }
  }
}

function TabCard({ card }: { card: CardState }) {
  if (card.kind === "empty") {
    return (
      <div className="tab-card tab-card--empty">
        <div className="tab-card-inner">
          <div className="tab-meta">
            <div className="title muted">{t("popup_no_tab_selected")}</div>
            <div className="url">{t("popup_choose_tab")}</div>
          </div>
        </div>
      </div>
    )
  }

  const dimmed = card.kind === "stale-closed" || card.kind === "stale-incompatible"
  const statusKey =
    card.kind === "selected-is-current" ||
    card.kind === "stale-closed" ||
    card.kind === "stale-incompatible"
      ? card.statusKey
      : null

  return (
    <div className={`tab-card${dimmed ? " tab-card--dimmed" : ""}`}>
      <div className="tab-card-inner">
        <div className="tab-meta">
          <div className="title">{card.title || card.origin}</div>
          <div className="url">{card.origin}</div>
        </div>
        {statusKey && <span className={`pill pill--${pillTone(card.kind)}`}>{t(statusKey)}</span>}
      </div>
    </div>
  )
}

function pillTone(kind: CardState["kind"]): string {
  if (kind === "selected-is-current") return "success"
  if (kind === "stale-closed") return "warning"
  if (kind === "stale-incompatible") return "danger"
  return ""
}

function PrimaryCta({
  cta,
  onArm,
  onDisarm,
}: {
  cta: CtaState
  onArm: () => void
  onDisarm: () => void
}) {
  if (cta.kind === "success") {
    return (
      <button type="button" className="cta-btn primary" onClick={onDisarm}>
        {t(cta.labelKey)}
      </button>
    )
  }

  if (cta.kind === "secondary") {
    return (
      <button type="button" className="cta-btn secondary" onClick={onDisarm}>
        {t(cta.labelKey)}
      </button>
    )
  }

  return (
    <button
      type="button"
      className="cta-btn primary"
      disabled={cta.kind === "use-current" ? !cta.enabled : false}
      onClick={onArm}
    >
      {t(cta.labelKey)}
    </button>
  )
}
