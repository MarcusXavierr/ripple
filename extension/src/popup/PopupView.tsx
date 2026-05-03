type CardState =
  | { kind: "empty" }
  | { kind: "selected"; title?: string; origin: string }
  | { kind: "selected-is-current"; title?: string; origin: string }
  | { kind: "stale-closed"; title?: string; origin: string }
  | { kind: "stale-incompatible"; title?: string; origin: string }

type CtaState =
  | { kind: "use-current"; enabled: boolean; reason?: string }
  | { kind: "already-selected" }

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
        {cta.kind === "use-current" && cta.reason && <p className="warning-chip">{cta.reason}</p>}
        {(card.kind === "stale-closed" || card.kind === "stale-incompatible") && (
          <p className="warning-chip">
            {card.kind === "stale-closed"
              ? "Selected tab is no longer available."
              : "Selected tab is on a page Ripple can't control."}
          </p>
        )}
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
    card.kind === "selected-is-current"
      ? { label: "Selected", tone: "success" as const }
      : card.kind === "stale-closed"
        ? { label: "Tab closed", tone: "warning" as const }
        : card.kind === "stale-incompatible"
          ? { label: "Unavailable", tone: "danger" as const }
          : null

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

export type { CardState, CtaState, PopupViewProps }
