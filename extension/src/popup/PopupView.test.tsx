import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
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

    expect(screen.getByText(/no tab selected yet/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /use current tab/i })).toBeEnabled()
    expect(screen.queryByRole("button", { name: /clear/i })).not.toBeInTheDocument()
  })

  it("state 2: empty selection, current incompatible — disabled CTA + warning", () => {
    render(
      <PopupView
        {...baseProps}
        card={{ kind: "empty" }}
        cta={{ kind: "use-current", enabled: false, reason: "Cannot control chrome:// pages." }}
        canClear={false}
      />
    )

    expect(screen.getByRole("button", { name: /use current tab/i })).toBeDisabled()
    expect(screen.getByText(/chrome:\/\//i)).toBeInTheDocument()
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
    expect(screen.getByRole("button", { name: /use current tab/i })).toBeEnabled()
    expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument()
  })

  it("state 5: selection equals current — success-styled disabled CTA", () => {
    render(
      <PopupView
        {...baseProps}
        card={{ kind: "selected-is-current", title: "ADRs", origin: "https://adr.github.io" }}
        cta={{ kind: "already-selected" }}
        canClear
      />
    )

    expect(screen.getByText(/this tab is selected/i)).toBeInTheDocument()
    expect(screen.getByText(/^selected$/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /this tab is selected/i })).toBeDisabled()
  })

  it("state 6a: selected tab closed — shows stale state + warning", () => {
    render(
      <PopupView
        {...baseProps}
        card={{ kind: "stale-closed", title: "Old tab", origin: "https://example.com" }}
        cta={{ kind: "use-current", enabled: true }}
        canClear
      />
    )

    expect(screen.getByText(/tab closed/i)).toBeInTheDocument()
    expect(screen.getByText(/no longer available/i)).toBeInTheDocument()
  })

  it("state 6b: selected tab navigated to incompatible page", () => {
    render(
      <PopupView
        {...baseProps}
        card={{ kind: "stale-incompatible", title: "Settings", origin: "chrome://settings" }}
        cta={{ kind: "use-current", enabled: true }}
        canClear
      />
    )

    expect(screen.getByText(/unavailable/i)).toBeInTheDocument()
    expect(screen.getByText(/can't control/i)).toBeInTheDocument()
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

    fireEvent.click(screen.getByRole("button", { name: /use current tab/i }))
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

    fireEvent.click(screen.getByRole("button", { name: /clear/i }))
    expect(onClearSelectedTab).toHaveBeenCalledOnce()
  })
})
