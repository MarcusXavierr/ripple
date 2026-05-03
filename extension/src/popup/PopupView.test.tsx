import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("../i18n/t", () => ({
  t: (key: string, substitutions?: string | string[]) =>
    (
      ({
        popup_title: "Ripple",
        popup_tagline: "Cliques remotos",
        popup_selected_tab_label: "Aba selecionada",
        popup_clear_selected_tab: "Limpar aba selecionada",
        popup_no_tab_selected: "Nenhuma aba selecionada ainda",
        popup_choose_tab: "Escolha uma aba para receber cliques remotos.",
        popup_use_current_tab: "Usar aba atual",
        popup_grant_access: "Conceder acesso",
        popup_stop_controlling: "Parar de controlar",
        popup_tab_selected: "Esta aba está selecionada ✓",
        popup_status_selected: "Selecionada",
        popup_status_tab_closed: "Aba fechada",
        popup_status_unavailable: "Indisponível",
        popup_reason_selected_tab_closed: "A aba selecionada não está mais disponível.",
        popup_reason_selected_tab_incompatible:
          "A aba selecionada está em uma página que o Ripple não consegue controlar.",
        popup_reason_permission_lost: `Esta aba mudou para outro site: ${
          Array.isArray(substitutions) ? substitutions[0] : substitutions
        }. Conceda acesso novamente para continuar.`,
      }) as Record<string, string>
    )[key],
}))

import { PopupView } from "./PopupView"

const armed = {
  tabId: 42,
  windowId: 1,
  title: "YouTube",
  url: "https://youtube.com/watch?v=1",
  origin: "https://youtube.com",
  selectedAt: 0,
}

describe("PopupView", () => {
  it("renders idle with the original empty card and current-tab CTA", () => {
    render(<PopupView state={{ kind: "idle" }} onArm={vi.fn()} onDisarm={vi.fn()} />)

    expect(screen.getByText(/nenhuma aba selecionada ainda/i)).toBeInTheDocument()
    expect(screen.getByText(/escolha uma aba para receber cliques remotos/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /usar aba atual/i })).toBeEnabled()
  })

  it("renders pendingApproval inside the existing card shell", () => {
    render(
      <PopupView state={{ kind: "pendingApproval", armed }} onArm={vi.fn()} onDisarm={vi.fn()} />
    )

    expect(screen.getByText("YouTube")).toBeInTheDocument()
    expect(screen.getByText("https://youtube.com")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /conceder acesso/i })).toBeInTheDocument()
  })

  it("renders controllable with selected pill and stop button", () => {
    const onDisarm = vi.fn()

    render(
      <PopupView state={{ kind: "controllable", armed }} onArm={vi.fn()} onDisarm={onDisarm} />
    )

    expect(screen.getByText(/^selecionada$/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /parar de controlar/i }))
    expect(onDisarm).toHaveBeenCalledOnce()
  })

  it("renders permissionLost with unavailable styling and translated warning", () => {
    const onArm = vi.fn()

    render(
      <PopupView
        state={{ kind: "permissionLost", armed, currentOrigin: "https://google.com" }}
        onArm={onArm}
        onDisarm={vi.fn()}
      />
    )

    expect(screen.getByText(/^indisponível$/i)).toBeInTheDocument()
    expect(screen.getByText(/esta aba mudou para outro site/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /conceder acesso/i }))
    expect(onArm).toHaveBeenCalledOnce()
  })

  it("renders tabClosed with warning card and clear button", () => {
    const onDisarm = vi.fn()

    render(<PopupView state={{ kind: "tabClosed", armed }} onArm={vi.fn()} onDisarm={onDisarm} />)

    expect(screen.getByText(/^aba fechada$/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /limpar aba selecionada/i }))
    expect(onDisarm).toHaveBeenCalledOnce()
  })
})
