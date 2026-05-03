import type { CardState, CtaState } from "./derivePopupState"

type PopupViewProps = {
  card: CardState
  cta: CtaState
  canClear: boolean
  onUseCurrentTab: () => void
  onClearSelectedTab: () => void
}

const PILL_BY_KIND = {
  "selected-is-current": { label: "Selected", tone: "success" },
  "stale-closed": { label: "Tab closed", tone: "warning" },
  "stale-incompatible": { label: "Unavailable", tone: "danger" },
} as const

const STALE_CARD_REASON = {
  "stale-closed": "Selected tab is no longer available.",
  "stale-incompatible": "Selected tab is on a page Ripple can't control.",
} as const

export function PopupView({
  card,
  cta,
  canClear,
  onUseCurrentTab,
  onClearSelectedTab,
}: PopupViewProps) {
  const ctaReason = cta.kind === "use-current" ? cta.reason : undefined
  const staleReason =
    card.kind === "stale-closed" || card.kind === "stale-incompatible"
      ? STALE_CARD_REASON[card.kind]
      : undefined

  return (
    <main className="popup">
      <header className="popup-header">
        <img className="ripple-logo" src="/favicon.svg" alt="" width={36} height={36} />
        <div className="popup-title">
          <div className="name">Ripple Control</div>
          <div className="tagline">Remote click target</div>
        </div>
      </header>

      <section className="section">
        <div className="section-label">Selected tab</div>
        <TabCard card={card} />
        <PrimaryCta cta={cta} onClick={onUseCurrentTab} />
        {ctaReason && <p className="warning-chip">{ctaReason}</p>}
        {staleReason && <p className="warning-chip">{staleReason}</p>}
      </section>

      {canClear && (
        <footer className="popup-footer">
          <button type="button" className="cta-btn secondary" onClick={onClearSelectedTab}>
            Clear selected tab
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
            <div className="title muted">No tab selected yet</div>
            <div className="url">Choose a tab to receive remote clicks.</div>
          </div>
        </div>
      </div>
    )
  }

  const dimmed = card.kind === "stale-closed" || card.kind === "stale-incompatible"
  const pill =
    card.kind in PILL_BY_KIND ? PILL_BY_KIND[card.kind as keyof typeof PILL_BY_KIND] : null

  return (
    <div className={`tab-card${dimmed ? " tab-card--dimmed" : ""}`}>
      <div className="tab-card-inner">
        <div className="tab-meta">
          <div className="title">{card.title || card.origin}</div>
          <div className="url">{card.origin}</div>
        </div>
        {pill && <span className={`pill pill--${pill.tone}`}>{pill.label}</span>}
      </div>
    </div>
  )
}

function PrimaryCta({ cta, onClick }: { cta: CtaState; onClick: () => void }) {
  if (cta.kind === "already-selected") {
    return (
      <button type="button" className="cta-btn primary cta-btn--success" disabled>
        This tab is selected ✓
      </button>
    )
  }

  return (
    <button type="button" className="cta-btn primary" disabled={!cta.enabled} onClick={onClick}>
      Use current tab
    </button>
  )
}
