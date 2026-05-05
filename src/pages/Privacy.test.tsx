import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterAll, beforeAll, vi } from "vitest"
import i18n from "../i18n"
import Privacy from "./Privacy"

vi.stubEnv("VITE_CONTACT_EMAIL", "test@example.com")

function renderPrivacy() {
  return render(
    <MemoryRouter>
      <Privacy />
    </MemoryRouter>
  )
}

beforeAll(() => {
  // jsdom doesn't implement IntersectionObserver
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  // @ts-expect-error stub for jsdom
  globalThis.IntersectionObserver = IO
})

afterAll(async () => {
  await i18n.changeLanguage("en")
})

describe("Privacy page (en)", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en")
  })

  it("renders the hero label", () => {
    renderPrivacy()
    expect(screen.getByText("Legal & Privacy")).toBeInTheDocument()
  })

  it("renders all eight section titles", () => {
    renderPrivacy()
    expect(screen.getByRole("heading", { name: /what the extension stores/i })).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: /what the extension sends over the network/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: /what the extension does not collect/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: /permissions the extension requests/i })
    ).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /^your control$/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /cross-origin re-approval/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /^security$/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /questions or concerns\?/i })).toBeInTheDocument()
  })

  it("has a Back to home link pointing at /", () => {
    renderPrivacy()
    const back = screen.getByRole("link", { name: /back to home/i })
    expect(back).toHaveAttribute("href", "/")
  })

  it("has a mailto: contact CTA using VITE_CONTACT_EMAIL", () => {
    renderPrivacy()
    const cta = screen.getByRole("link", { name: /email me/i })
    expect(cta).toHaveAttribute("href", "mailto:test@example.com")
  })
})

describe("Privacy page (pt-BR)", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR")
  })

  it("renders the pt-BR hero label", () => {
    renderPrivacy()
    expect(screen.getByText("Privacidade")).toBeInTheDocument()
  })

  it("renders the pt-BR back-to-home label", () => {
    renderPrivacy()
    expect(screen.getByRole("link", { name: /voltar ao início/i })).toBeInTheDocument()
  })
})
