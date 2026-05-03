import { t } from "../i18n/t"
import type { CardState, CtaState } from "./derivePopupState"

type PopupViewProps = {
  card: CardState
  cta: CtaState
  canClear: boolean
  onUseCurrentTab: () => void
  onClearSelectedTab: () => void
}

export function PopupView({
  card,
  cta,
  canClear,
  onUseCurrentTab,
  onClearSelectedTab,
}: PopupViewProps) {
  const ctaReason = cta.kind === "use-current" && cta.reasonKey ? t(cta.reasonKey) : undefined
  const staleReason =
    card.kind === "stale-closed" || card.kind === "stale-incompatible"
      ? t(card.staleReasonKey)
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
        <TabCard card={card} />
        <PrimaryCta cta={cta} onClick={onUseCurrentTab} />
        {ctaReason && <p className="warning-chip">{ctaReason}</p>}
        {staleReason && <p className="warning-chip">{staleReason}</p>}
      </section>

      {canClear && (
        <footer className="popup-footer">
          <button type="button" className="cta-btn secondary" onClick={onClearSelectedTab}>
            {t("popup_clear_selected_tab")}
          </button>
        </footer>
      )}
    </main>
  )
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

function PrimaryCta({ cta, onClick }: { cta: CtaState; onClick: () => void }) {
  if (cta.kind === "already-selected") {
    return (
      <button type="button" className="cta-btn primary cta-btn--success" disabled>
        {t("popup_tab_selected")}
      </button>
    )
  }

  return (
    <button type="button" className="cta-btn primary" disabled={!cta.enabled} onClick={onClick}>
      {t("popup_use_current_tab")}
    </button>
  )
}
