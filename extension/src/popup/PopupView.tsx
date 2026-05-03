import { t } from "../i18n/t"
import type { PopupState } from "./derivePopupState"

export type PopupViewProps = {
  state: PopupState
  onArm: () => void
  onDisarm: () => void
}

export function PopupView({ state, onArm, onDisarm }: PopupViewProps) {
  return (
    <main className="popup">
      <header className="popup-header">
        <img className="ripple-logo" src="/favicon.svg" alt="" width={36} height={36} />
        <div className="popup-title">
          <div className="name">{t("popup_title")}</div>
          <div className="tagline">{t("popup_tagline")}</div>
        </div>
      </header>

      <section className="section">{renderBody(state, onArm, onDisarm)}</section>
    </main>
  )
}

function renderBody(state: PopupState, onArm: () => void, onDisarm: () => void) {
  switch (state.kind) {
    case "idle":
      return (
        <button type="button" className="cta-btn primary" onClick={onArm}>
          Control this tab
        </button>
      )
    case "pendingApproval":
      return (
        <>
          <p>{state.armed.title ?? state.armed.origin}</p>
          <button type="button" className="cta-btn primary" onClick={onArm}>
            Grant access
          </button>
        </>
      )
    case "controllable":
      return (
        <>
          <p>{state.armed.title ?? state.armed.origin}</p>
          <button type="button" className="cta-btn primary cta-btn--success" onClick={onDisarm}>
            Stop controlling
          </button>
        </>
      )
    case "permissionLost":
      return (
        <>
          <p>
            The armed tab is on a different site ({state.currentOrigin}). Re-approve to continue.
          </p>
          <button type="button" className="cta-btn primary" onClick={onArm}>
            Grant access
          </button>
        </>
      )
    case "tabClosed":
      return (
        <>
          <p>The armed tab was closed.</p>
          <button type="button" className="cta-btn secondary" onClick={onDisarm}>
            Clear
          </button>
        </>
      )
  }
}
