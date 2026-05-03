import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("../i18n/t", () => ({
  t: (key: string) =>
    ({
      popup_title: "Ripple",
      popup_tagline: "Cliques remotos",
      popup_selected_tab_label: "Aba selecionada",
      popup_clear_selected_tab: "Limpar aba selecionada",
      popup_no_tab_selected: "Nenhuma aba selecionada ainda",
      popup_choose_tab: "Escolha uma aba para receber cliques remotos.",
      popup_use_current_tab: "Usar aba atual",
      popup_tab_selected: "Esta aba está selecionada ✓",
      popup_status_selected: "Selecionada",
      popup_status_tab_closed: "Aba fechada",
      popup_status_unavailable: "Indisponível",
      popup_reason_selected_tab_closed: "A aba selecionada não está mais disponível.",
      popup_reason_selected_tab_incompatible:
        "A aba selecionada está em uma página que o Ripple não consegue controlar.",
      reason_tab_chrome_internal: "Páginas internas do Chrome não podem ser controladas.",
      popup_loading_current_tab: "Carregando aba atual.",
    })[key],
}))

import { PopupView } from "./PopupView"

const baseProps = {
  onUseCurrentTab: vi.fn(),
  onClearSelectedTab: vi.fn(),
}

describe("PopupView", () => {
  it("state 1: empty selection, current compatible — shows empty card and enabled CTA", () => {
    render(
      <PopupView
        {...baseProps}
        card={{ kind: "empty" }}
        cta={{ kind: "use-current", enabled: true }}
        canClear={false}
      />
    )

    expect(screen.getByText(/nenhuma aba selecionada ainda/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /usar aba atual/i })).toBeEnabled()
    expect(screen.queryByRole("button", { name: /limpar/i })).not.toBeInTheDocument()
  })

  it("state 2: empty selection, current incompatible — disabled CTA + warning", () => {
    render(
      <PopupView
        {...baseProps}
        card={{ kind: "empty" }}
        cta={{ kind: "use-current", enabled: false, reasonKey: "reason_tab_chrome_internal" }}
        canClear={false}
      />
    )

    expect(screen.getByRole("button", { name: /usar aba atual/i })).toBeDisabled()
    expect(screen.getByText(/páginas internas do chrome/i)).toBeInTheDocument()
  })

  it("state 3: selection differs from current, current compatible — shows selected tab + Clear", () => {
    render(
      <PopupView
        {...baseProps}
        card={{ kind: "selected", title: "ADRs", origin: "https://adr.github.io" }}
        cta={{ kind: "use-current", enabled: true }}
        canClear
      />
    )

    expect(screen.getByText("ADRs")).toBeInTheDocument()
    expect(screen.getByText("https://adr.github.io")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /usar aba atual/i })).toBeEnabled()
    expect(screen.getByRole("button", { name: /limpar/i })).toBeInTheDocument()
  })

  it("state 5: selection equals current — success-styled disabled CTA", () => {
    render(
      <PopupView
        {...baseProps}
        card={{
          kind: "selected-is-current",
          title: "ADRs",
          origin: "https://adr.github.io",
          statusKey: "popup_status_selected",
        }}
        cta={{ kind: "already-selected" }}
        canClear
      />
    )

    expect(screen.getByText(/esta aba está selecionada/i)).toBeInTheDocument()
    expect(screen.getByText(/^selecionada$/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /esta aba está selecionada/i })).toBeDisabled()
  })

  it("state 6a: selected tab closed — shows stale state + warning", () => {
    render(
      <PopupView
        {...baseProps}
        card={{
          kind: "stale-closed",
          title: "Old tab",
          origin: "https://example.com",
          statusKey: "popup_status_tab_closed",
          staleReasonKey: "popup_reason_selected_tab_closed",
        }}
        cta={{ kind: "use-current", enabled: true }}
        canClear
      />
    )

    expect(screen.getByText(/aba fechada/i)).toBeInTheDocument()
    expect(screen.getByText(/não está mais disponível/i)).toBeInTheDocument()
  })

  it("state 6b: selected tab navigated to incompatible page", () => {
    render(
      <PopupView
        {...baseProps}
        card={{
          kind: "stale-incompatible",
          title: "Settings",
          origin: "chrome://settings",
          statusKey: "popup_status_unavailable",
          staleReasonKey: "popup_reason_selected_tab_incompatible",
        }}
        cta={{ kind: "use-current", enabled: true }}
        canClear
      />
    )

    expect(screen.getByText(/indisponível/i)).toBeInTheDocument()
    expect(screen.getByText(/não consegue controlar/i)).toBeInTheDocument()
  })

  it("calls onUseCurrentTab when primary CTA clicked", () => {
    const onUseCurrentTab = vi.fn()

    render(
      <PopupView
        {...baseProps}
        onUseCurrentTab={onUseCurrentTab}
        card={{ kind: "empty" }}
        cta={{ kind: "use-current", enabled: true }}
        canClear={false}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /usar aba atual/i }))
    expect(onUseCurrentTab).toHaveBeenCalledOnce()
  })

  it("calls onClearSelectedTab when Clear clicked", () => {
    const onClearSelectedTab = vi.fn()

    render(
      <PopupView
        {...baseProps}
        onClearSelectedTab={onClearSelectedTab}
        card={{ kind: "selected", title: "X", origin: "https://x.com" }}
        cta={{ kind: "use-current", enabled: true }}
        canClear
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /limpar/i }))
    expect(onClearSelectedTab).toHaveBeenCalledOnce()
  })
})
