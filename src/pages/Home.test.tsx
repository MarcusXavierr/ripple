import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, vi } from "vitest"

const mockNavigate = vi.fn()
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock("@/lib/room", () => ({
  generateRoomSlug: vi.fn(() => "coral-tiger-42"),
  parseRoomInput: vi.fn(),
}))

import { generateRoomSlug, parseRoomInput } from "@/lib/room"
import i18n from "../i18n"
import Home from "./Home"

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width, writable: true })
  window.dispatchEvent(new Event("resize"))
}

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  )
}

describe("Home page", () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    vi.mocked(parseRoomInput).mockReset()
    vi.mocked(generateRoomSlug).mockReturnValue("coral-tiger-42")
    localStorage.clear()
    vi.stubGlobal("fetch", vi.fn())
    setViewportWidth(1280)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  describe("legacy routing/create-room", () => {
    it("renders a Create Room button", () => {
      renderHome()
      expect(screen.getByRole("button", { name: /create room/i })).toBeInTheDocument()
    })

    it("renders a Privacy nav link pointing to /privacy", () => {
      renderHome()
      const link = screen.getByRole("link", { name: /^privacy$/i })
      expect(link).toHaveAttribute("href", "/privacy")
    })

    it("renders a join input and Join button", () => {
      renderHome()
      expect(screen.getByLabelText(/room id or link/i)).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /join room/i })).toBeInTheDocument()
    })

    it("navigates to /room/<slug> when Create Room is clicked", async () => {
      const user = userEvent.setup()
      renderHome()
      await user.click(screen.getByRole("button", { name: /create room/i }))
      expect(mockNavigate).toHaveBeenCalledWith("/room/coral-tiger-42")
    })

    it("navigates to the room when a valid ID is submitted", async () => {
      vi.mocked(parseRoomInput).mockReturnValueOnce("amber-wolf-7")
      const user = userEvent.setup()
      renderHome()
      await user.type(screen.getByLabelText(/room id or link/i), "amber-wolf-7")
      await user.click(screen.getByRole("button", { name: /join room/i }))
      expect(mockNavigate).toHaveBeenCalledWith("/room/amber-wolf-7")
    })

    it("shows an error message when submitted with an empty join input", async () => {
      const user = userEvent.setup()
      renderHome()
      await user.click(screen.getByRole("button", { name: /join room/i }))
      expect(screen.getByText(/enter a valid room id or link/i)).toBeInTheDocument()
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("clears the join error when the user starts typing after a failed submit", async () => {
      const user = userEvent.setup()
      renderHome()
      await user.click(screen.getByRole("button", { name: /join room/i }))
      expect(screen.getByText(/enter a valid room id or link/i)).toBeInTheDocument()
      await user.type(screen.getByLabelText(/room id or link/i), "a")
      expect(screen.queryByText(/enter a valid room id or link/i)).not.toBeInTheDocument()
    })

    it("generates a new slug when 'Suggest another name' is clicked", async () => {
      vi.mocked(generateRoomSlug)
        .mockReturnValueOnce("coral-tiger-42")
        .mockReturnValueOnce("jade-wolf-99")
      const user = userEvent.setup()
      renderHome()
      await user.click(screen.getByRole("button", { name: /suggest another name/i }))
      expect(screen.getByText(/jade-wolf-99/i)).toBeInTheDocument()
    })
  })

  describe("Hero presentation", () => {
    it("Eyebrow announces the Chrome waitlist", () => {
      setViewportWidth(1280)
      renderHome()
      expect(screen.getByText("Coming to Chrome · join the waitlist")).toBeInTheDocument()
    })

    it("Eyebrow is shortened on narrow viewports", () => {
      setViewportWidth(600)
      renderHome()
      expect(screen.getByText("Coming to Chrome")).toBeInTheDocument()
      expect(screen.queryByText("Coming to Chrome · join the waitlist")).not.toBeInTheDocument()
    })

    it("Three feature chips are visible", () => {
      renderHome()
      expect(screen.getByText("End‑to‑end encrypted")).toBeInTheDocument()
      expect(screen.getByText("One‑click screen share")).toBeInTheDocument()
      expect(screen.getByText("No accounts")).toBeInTheDocument()
    })
  })

  describe("Waitlist signup — happy path", () => {
    it("Visitor joins the waitlist with a valid email", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal("fetch", fetchMock)
      const user = userEvent.setup()
      renderHome()

      await user.type(screen.getByLabelText(/you@domain.com/i), "alice@example.com")
      await user.click(screen.getByRole("button", { name: /notify me on launch/i }))

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1)
      })
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:9999/waitlist",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "alice@example.com" }),
        })
      )

      await waitFor(() => {
        expect(screen.getByText(/you're on the list/i)).toBeInTheDocument()
      })
      expect(screen.getByText(/alice@example\.com/)).toBeInTheDocument()

      const stored = JSON.parse(localStorage.getItem("ripple.ext.notify") ?? "null")
      expect(stored).toMatchObject({ v: 1, email: "alice@example.com" })
      expect(typeof stored.ts).toBe("number")
    })

    it("Returning visitor sees confirmation immediately", () => {
      localStorage.setItem(
        "ripple.ext.notify",
        JSON.stringify({ v: 1, email: "alice@example.com", ts: 1700000000000 })
      )
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)
      renderHome()

      expect(screen.getByText(/you're on the list/i)).toBeInTheDocument()
      expect(screen.queryByLabelText(/you@domain.com/i)).not.toBeInTheDocument()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("Visitor changes their submitted email", async () => {
      localStorage.setItem(
        "ripple.ext.notify",
        JSON.stringify({ v: 1, email: "alice@example.com", ts: 1700000000000 })
      )
      const user = userEvent.setup()
      renderHome()

      await user.click(screen.getByRole("button", { name: /^change$/i }))

      expect(screen.getByLabelText(/you@domain.com/i)).toBeInTheDocument()
      expect(localStorage.getItem("ripple.ext.notify")).toBeNull()
    })
  })

  describe("Waitlist signup — validation and errors", () => {
    it("Visitor submits an invalid email", async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)
      const user = userEvent.setup()
      renderHome()

      await user.type(screen.getByLabelText(/you@domain.com/i), "not-an-email")
      await user.click(screen.getByRole("button", { name: /notify me on launch/i }))

      expect(screen.getByRole("alert")).toHaveTextContent(/enter a valid email/i)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("Visitor submits an empty email", async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)
      const user = userEvent.setup()
      renderHome()

      await user.click(screen.getByRole("button", { name: /notify me on launch/i }))

      expect(screen.getByRole("alert")).toHaveTextContent(/enter a valid email/i)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("Email is trimmed before validation and submission", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal("fetch", fetchMock)
      const user = userEvent.setup()
      renderHome()

      await user.type(screen.getByLabelText(/you@domain.com/i), "  alice@example.com  ")
      await user.click(screen.getByRole("button", { name: /notify me on launch/i }))

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1)
      })
      const [, init] = fetchMock.mock.calls[0]
      expect(init.body).toBe(JSON.stringify({ email: "alice@example.com" }))
    })

    it("Waitlist service is unreachable", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("network"))
      vi.stubGlobal("fetch", fetchMock)
      const user = userEvent.setup()
      renderHome()

      await user.type(screen.getByLabelText(/you@domain.com/i), "alice@example.com")
      await user.click(screen.getByRole("button", { name: /notify me on launch/i }))

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/couldn't reach the waitlist/i)
      })
      expect(localStorage.getItem("ripple.ext.notify")).toBeNull()
      expect(screen.getByLabelText(/you@domain.com/i)).toBeInTheDocument()
    })

    it("Waitlist service rejects the submission", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 })
      vi.stubGlobal("fetch", fetchMock)
      const user = userEvent.setup()
      renderHome()

      await user.type(screen.getByLabelText(/you@domain.com/i), "alice@example.com")
      await user.click(screen.getByRole("button", { name: /notify me on launch/i }))

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/couldn't reach the waitlist/i)
      })
      expect(localStorage.getItem("ripple.ext.notify")).toBeNull()
    })
  })

  describe("Waitlist signup — submission discipline", () => {
    it("Double-clicking does not produce duplicate signups", async () => {
      let resolveFetch!: (value: { ok: true }) => void
      const fetchMock = vi.fn(
        () =>
          new Promise<{ ok: true }>((resolve) => {
            resolveFetch = resolve
          })
      )
      vi.stubGlobal("fetch", fetchMock)
      const user = userEvent.setup()
      renderHome()

      await user.type(screen.getByLabelText(/you@domain.com/i), "alice@example.com")
      const button = screen.getByRole("button", {
        name: /notify me on launch/i,
      }) as HTMLButtonElement
      await user.click(button)
      await user.click(button)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(button).toBeDisabled()

      resolveFetch({ ok: true })
      await waitFor(() => {
        expect(screen.getByText(/you're on the list/i)).toBeInTheDocument()
      })
    })

    it("Production build without a configured waitlist endpoint", async () => {
      vi.stubEnv("DEV", false)
      vi.stubEnv("VITE_WAITLIST_URL", "")
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)
      const user = userEvent.setup()
      renderHome()

      await user.type(screen.getByLabelText(/you@domain.com/i), "alice@example.com")
      await user.click(screen.getByRole("button", { name: /notify me on launch/i }))

      expect(screen.getByRole("alert")).toHaveTextContent(/waitlist isn't available/i)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("VITE_WAITLIST_URL override", async () => {
      vi.stubEnv("VITE_WAITLIST_URL", "https://example.test/waitlist")
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal("fetch", fetchMock)
      const user = userEvent.setup()
      renderHome()

      await user.type(screen.getByLabelText(/you@domain.com/i), "alice@example.com")
      await user.click(screen.getByRole("button", { name: /notify me on launch/i }))

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1)
      })
      expect(fetchMock.mock.calls[0][0]).toBe("https://example.test/waitlist")
    })
  })

  describe("Accessibility", () => {
    it("Inline error is announced to assistive tech", async () => {
      const user = userEvent.setup()
      renderHome()

      await user.type(screen.getByLabelText(/you@domain.com/i), "not-an-email")
      await user.click(screen.getByRole("button", { name: /notify me on launch/i }))

      const alert = screen.getByRole("alert")
      expect(alert).toBeInTheDocument()
      expect(alert).toHaveAttribute("id", "waitlist-error")

      const input = screen.getByLabelText(/you@domain.com/i)
      expect(input).toHaveAttribute("aria-invalid", "true")
      expect(input).toHaveAttribute("aria-describedby", "waitlist-error")
    })
  })

  describe("Localization", () => {
    afterEach(async () => {
      await i18n.changeLanguage("en")
    })

    it("pt-BR locale renders translated strings", async () => {
      await i18n.changeLanguage("pt-BR")
      renderHome()
      expect(screen.getByText("Chegando no Chrome · entra na lista")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /me avisa quando sair/i })).toBeInTheDocument()
    })
  })
})
