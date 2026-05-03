import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { PopupView } from "./PopupView"

vi.mock("../i18n/t", () => ({
  t: (key: string) =>
    ({
      popup_title: "Ripple",
      popup_tagline: "Remote input",
    })[key] ?? key,
}))

const armed = {
  tabId: 42,
  windowId: 1,
  title: "Example",
  url: "https://example.com/x",
  origin: "https://example.com",
  selectedAt: 0,
}

describe("PopupView", () => {
  it("renders idle with arm button", async () => {
    const onArm = vi.fn()

    render(<PopupView state={{ kind: "idle" }} onArm={onArm} onDisarm={vi.fn()} />)

    await userEvent.click(screen.getByRole("button", { name: /control this tab/i }))
    expect(onArm).toHaveBeenCalledOnce()
  })

  it("renders pendingApproval with grant access button", async () => {
    const onArm = vi.fn()

    render(
      <PopupView state={{ kind: "pendingApproval", armed }} onArm={onArm} onDisarm={vi.fn()} />
    )

    await userEvent.click(screen.getByRole("button", { name: /grant access/i }))
    expect(onArm).toHaveBeenCalledOnce()
  })

  it("renders controllable with stop button", async () => {
    const onDisarm = vi.fn()

    render(
      <PopupView state={{ kind: "controllable", armed }} onArm={vi.fn()} onDisarm={onDisarm} />
    )

    await userEvent.click(screen.getByRole("button", { name: /stop controlling/i }))
    expect(onDisarm).toHaveBeenCalledOnce()
  })

  it("renders permissionLost explaining cross-origin", () => {
    render(
      <PopupView
        state={{ kind: "permissionLost", armed, currentOrigin: "https://other.test" }}
        onArm={vi.fn()}
        onDisarm={vi.fn()}
      />
    )

    expect(screen.getByText(/different site/i)).toBeInTheDocument()
    expect(screen.getByText(/https:\/\/other\.test/i)).toBeInTheDocument()
  })

  it("renders tabClosed", () => {
    render(<PopupView state={{ kind: "tabClosed", armed }} onArm={vi.fn()} onDisarm={vi.fn()} />)

    expect(screen.getByText(/closed/i)).toBeInTheDocument()
  })
})
