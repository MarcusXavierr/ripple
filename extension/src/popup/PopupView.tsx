type SelectedTabView = {
  title?: string
  origin: string
} | null

type CurrentTabView =
  | { compatible: true; title?: string; url: string }
  | { compatible: false; title?: string; url?: string; reason: string }

type PopupViewProps = {
  selectedTab: SelectedTabView
  currentTab: CurrentTabView
  onUseCurrentTab: () => void
}

export function PopupView({ selectedTab, currentTab, onUseCurrentTab }: PopupViewProps) {
  return (
    <main className="popup">
      <header className="popup__header">
        <span className="popup__mark" />
        <div>
          <h1>Ripple Control</h1>
          <p>Remote click target</p>
        </div>
      </header>

      <section className="popup__section">
        <h2>Selected tab</h2>
        {selectedTab ? (
          <div className="popup__selected">
            <strong>{selectedTab.title || selectedTab.origin}</strong>
            <span>{selectedTab.origin}</span>
          </div>
        ) : (
          <p className="popup__muted">No tab selected</p>
        )}
      </section>

      <button className="popup__button" type="button" disabled={!currentTab.compatible} onClick={onUseCurrentTab}>
        Use current tab
      </button>

      {!currentTab.compatible && <p className="popup__warning">{currentTab.reason}</p>}
    </main>
  )
}
