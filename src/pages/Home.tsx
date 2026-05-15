import { Globe, Lock, Mail, MonitorUp, Plus, Send, Sparkles } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"
import { generateRoomSlug, parseRoomInput } from "@/lib/room"

const WAITLIST_STORAGE_KEY = "ripple.ext.notify"
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type StoredWaitlist = { v: 1; email: string; ts: number }

function resolveWaitlistUrl(): string | null {
  const configured = import.meta.env.VITE_WAITLIST_URL
  if (typeof configured === "string" && configured.length > 0) return configured
  if (import.meta.env.DEV) return "http://localhost:9999/waitlist"
  return null
}

function readStored(): StoredWaitlist | null {
  try {
    const raw = localStorage.getItem(WAITLIST_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.v === 1 && typeof parsed.email === "string") return parsed
    return null
  } catch {
    return null
  }
}

export default function Home() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const viewport = useViewport()
  const [suggestion, setSuggestion] = useState(() => generateRoomSlug())
  const [joinInput, setJoinInput] = useState("")
  const [joinError, setJoinError] = useState<string | null>(null)

  function handleCreateRoom() {
    navigate(`/room/${suggestion}`)
  }

  function handleSuggestName() {
    setSuggestion(generateRoomSlug())
  }

  function handleJoinInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setJoinInput(e.target.value)
    if (joinError) setJoinError(null)
  }

  function handleJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const roomId = parseRoomInput(joinInput)
    if (!roomId) {
      setJoinError(t("home.card.joinError"))
      return
    }
    navigate(`/room/${roomId}`)
  }

  return (
    <div
      className="relative w-full min-h-screen"
      style={{
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
        background: `
          radial-gradient(ellipse 60% 50% at 12% 18%, oklch(94% 0.04 220 / 0.85), transparent 65%),
          radial-gradient(ellipse 50% 55% at 88% 20%, oklch(93% 0.05 235 / 0.8), transparent 65%),
          radial-gradient(ellipse 60% 45% at 85% 90%, oklch(94% 0.04 200 / 0.7), transparent 65%),
          linear-gradient(135deg, #f4f8fc 0%, #eef3f9 50%, #f1f6fb 100%)
        `,
      }}
    >
      {/* White highlight overlay (matches stage::after) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle at 25% 25%, rgba(255,255,255,0.3) 0%, transparent 30%),
            radial-gradient(circle at 75% 75%, rgba(255,255,255,0.2) 0%, transparent 30%)
          `,
          zIndex: 0,
        }}
      />

      {/* Animated blobs — clipped so they don't extend the page scroll */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
        <div
          className="absolute rounded-full"
          style={{
            width: 420,
            height: 420,
            background: "oklch(80% 0.10 220)",
            filter: "blur(80px)",
            opacity: 0.28,
            top: -120,
            left: -100,
            animation: "ripple-drift 24s ease-in-out infinite",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 380,
            height: 380,
            background: "oklch(82% 0.08 235)",
            filter: "blur(80px)",
            opacity: 0.28,
            top: "30%",
            right: -140,
            animation: "ripple-drift 24s ease-in-out infinite",
            animationDelay: "-8s",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 340,
            height: 340,
            background: "oklch(85% 0.07 200)",
            filter: "blur(80px)",
            opacity: 0.28,
            bottom: -120,
            left: "35%",
            animation: "ripple-drift 24s ease-in-out infinite",
            animationDelay: "-16s",
          }}
        />
      </div>

      {/* Grain overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 2,
          opacity: 0.4,
          mixBlendMode: "overlay",
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2'/></filter><rect width='200' height='200' filter='url(%23n)' opacity='0.35'/></svg>")`,
        }}
      />

      {/* Page shell */}
      <div
        className="relative flex flex-col"
        style={{ zIndex: 5, minHeight: "100vh", overflowY: "auto" }}
      >
        {/* Nav */}
        <nav
          style={{
            padding: viewport.mobile ? "18px 20px" : "26px 40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 16,
              fontWeight: 600,
              color: "var(--ripple-ink)",
              letterSpacing: "-0.01em",
            }}
          >
            <RippleMark size={28} />
            {t("nav.brand")}
          </div>
          <div
            style={{
              display: "flex",
              gap: 28,
              fontSize: 13,
              color: "var(--ripple-ink-soft)",
              alignItems: "center",
            }}
          >
            <Link to="/privacy" style={{ color: "inherit", textDecoration: "none" }}>
              {t("nav.privacy")}
            </Link>
          </div>
        </nav>

        {/* Body */}
        <div
          style={{
            flex: 1,
            display: "grid",
            placeItems: viewport.mobile ? "start center" : "center",
            padding: viewport.mobile ? "20px 20px 28px" : "20px 40px",
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: viewport.narrow ? "1fr" : "1.05fr 1fr",
              gap: viewport.mobile ? 28 : viewport.narrow ? 36 : 72,
              maxWidth: viewport.narrow ? 560 : 1100,
              width: "100%",
              alignItems: viewport.mobile ? "flex-start" : "center",
            }}
          >
            {/* Hero — left column */}
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 12px 5px 5px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.55)",
                  border: "1px solid rgba(255,255,255,0.7)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  fontSize: 11.5,
                  color: "var(--ripple-ink-soft)",
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 6,
                    background:
                      "linear-gradient(135deg, var(--ripple-accent), var(--ripple-accent-strong))",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <ChromePuzzle size={11} color="white" />
                </span>
                {t(viewport.mobile ? "home.hero.eyebrowCompact" : "home.hero.eyebrow")}
              </div>

              <h1
                style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontSize: viewport.mobile ? 42 : viewport.narrow ? 56 : 70,
                  lineHeight: 0.95,
                  fontWeight: 400,
                  color: "var(--ripple-ink)",
                  margin: viewport.mobile ? "16px 0 14px" : "22px 0 18px",
                  letterSpacing: "-0.02em",
                }}
              >
                {t("home.hero.headlineLine1")}
                <br />
                <em style={{ fontStyle: "italic", color: "var(--ripple-accent-strong)" }}>
                  {t("home.hero.headlineLine2")}
                </em>
              </h1>

              <p
                style={{
                  fontSize: 16,
                  lineHeight: 1.5,
                  color: "var(--ripple-ink-soft)",
                  maxWidth: 440,
                  margin: 0,
                  marginBottom: viewport.mobile ? 20 : 26,
                }}
              >
                {t(viewport.mobile ? "home.hero.descriptionCompact" : "home.hero.description")}
              </p>

              <HeroEmailCTA compact={viewport.mobile} />

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: viewport.mobile ? 18 : 24,
                  flexWrap: "wrap",
                }}
              >
                <FeatureChip icon={<Lock size={12} />} label={t("home.hero.featureEncrypted")} />
                <FeatureChip
                  icon={<MonitorUp size={12} />}
                  label={t("home.hero.featureScreenShare")}
                />
                <FeatureChip
                  icon={<Sparkles size={12} />}
                  label={t("home.hero.featureNoAccounts")}
                />
              </div>
            </div>

            {/* Join card — right column */}
            <div
              className="glass-strong"
              style={{
                padding: 32,
                borderRadius: 28,
                display: "flex",
                flexDirection: "column",
                gap: 20,
                boxShadow:
                  "0 30px 80px rgba(60, 40, 120, 0.12), 0 4px 14px rgba(60, 40, 120, 0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <h2
                    style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "var(--ripple-ink)" }}
                  >
                    {t("home.card.title")}
                  </h2>
                  <LanguageToggle
                    currentLang={i18n.language}
                    onChange={(code) => i18n.changeLanguage(code)}
                  />
                </div>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--ripple-ink-mute)" }}>
                  {t("home.card.subtitle")}
                </p>
              </div>

              {/* Create room button */}
              <button
                type="button"
                onClick={handleCreateRoom}
                style={{
                  position: "relative",
                  padding: "16px 20px",
                  borderRadius: 16,
                  border: "none",
                  background:
                    "linear-gradient(135deg, var(--ripple-accent), var(--ripple-accent-strong))",
                  color: "white",
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  boxShadow:
                    "0 8px 24px oklch(70% 0.2 235 / 0.35), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.1)",
                  transition: "all 0.2s cubic-bezier(.2,.9,.3,1)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{t("home.card.createRoom")}</span>
                  <span style={{ fontSize: 11.5, opacity: 0.85, fontWeight: 400, marginTop: 2 }}>
                    ripple.app/{suggestion}
                  </span>
                </div>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 11,
                    background: "rgba(255,255,255,0.2)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Send size={14} />
                </div>
              </button>

              {/* Suggest another name chip */}
              <button
                type="button"
                onClick={handleSuggestName}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 11px 5px 9px",
                  borderRadius: 999,
                  background: "oklch(95% 0.03 var(--ripple-hue))",
                  border: "1px solid oklch(85% 0.06 var(--ripple-hue) / 0.5)",
                  fontSize: 11,
                  color: "var(--ripple-accent-strong)",
                  fontWeight: 500,
                  cursor: "pointer",
                  alignSelf: "flex-start",
                  marginTop: -8,
                }}
              >
                <Plus size={11} /> {t("home.card.suggestName")}
              </button>

              {/* OR divider */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 10.5,
                  color: "var(--ripple-ink-mute)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  fontWeight: 500,
                }}
              >
                <div style={{ flex: 1, height: 1, background: "rgba(20,40,80,0.10)" }} />
                {t("home.card.orJoin")}
                <div style={{ flex: 1, height: 1, background: "rgba(20,40,80,0.10)" }} />
              </div>

              {/* Join form */}
              <form
                onSubmit={handleJoin}
                noValidate
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "13px 14px",
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.7)",
                    border: "1px solid rgba(20,40,80,0.08)",
                  }}
                >
                  <Globe size={18} style={{ color: "var(--ripple-ink-mute)", flexShrink: 0 }} />
                  <input
                    aria-label={t("home.card.inputAriaLabel")}
                    type="text"
                    value={joinInput}
                    onChange={handleJoinInputChange}
                    placeholder={t("home.card.inputPlaceholder")}
                    autoComplete="off"
                    spellCheck={false}
                    aria-describedby={joinError ? "join-input-error" : undefined}
                    aria-invalid={joinError ? true : undefined}
                    className="join-input"
                    style={{
                      flex: 1,
                      border: "none",
                      background: "transparent",
                      outline: "none",
                      fontFamily: "inherit",
                      fontSize: 13.5,
                      color: "var(--ripple-ink)",
                    }}
                  />
                </div>

                {joinError && (
                  <p
                    id="join-input-error"
                    role="alert"
                    style={{ margin: 0, fontSize: 12, color: "oklch(0.577 0.245 27.325)" }}
                  >
                    {joinError}
                  </p>
                )}

                <button
                  type="submit"
                  style={{
                    padding: 13,
                    borderRadius: 14,
                    border: "1px solid rgba(20,40,80,0.10)",
                    background: "rgba(255,255,255,0.65)",
                    color: "var(--ripple-ink)",
                    fontFamily: "inherit",
                    fontSize: 13.5,
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transition: "all 0.2s",
                  }}
                >
                  {t("home.card.joinRoom")} <Send size={14} />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer
          style={{
            padding: viewport.mobile ? "14px 20px" : "18px 40px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 11.5,
            color: "var(--ripple-ink-mute)",
            flexShrink: 0,
          }}
        >
          <div>{t("home.footer.version")}</div>
          <div style={{ display: "flex", gap: 22 }}>
            <a
              href="https://github.com/MarcusXavierr/ripple"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              {t("home.footer.github")}
            </a>
          </div>
        </footer>
      </div>
    </div>
  )
}

const LANGS = [
  { code: "en", label: "EN" },
  { code: "pt-BR", label: "PT" },
] as const

function LanguageToggle({
  currentLang,
  onChange,
}: {
  currentLang: string
  onChange: (code: string) => void
}) {
  const currentIndex = LANGS.findIndex(({ code }) => code === currentLang)
  const next = LANGS[(currentIndex + 1) % LANGS.length]

  return (
    <button
      type="button"
      onClick={() => onChange(next.code)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: "3px 4px",
        borderRadius: 999,
        background: "oklch(95% 0.03 var(--ripple-hue))",
        border: "1px solid oklch(85% 0.06 var(--ripple-hue) / 0.5)",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {LANGS.map(({ code, label }) => {
        const active = currentLang === code
        return (
          <span
            key={code}
            style={{
              padding: "2px 8px",
              borderRadius: 999,
              background: active ? "var(--ripple-accent)" : "transparent",
              color: active ? "white" : "var(--ripple-ink-mute)",
              fontSize: 10.5,
              fontWeight: active ? 600 : 400,
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {label}
          </span>
        )
      })}
    </button>
  )
}

function FeatureChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "6px 11px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.45)",
        border: "1px solid rgba(255,255,255,0.65)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        fontSize: 11.5,
        fontWeight: 500,
        color: "var(--ripple-ink-soft)",
      }}
    >
      {icon}
      {label}
    </span>
  )
}

function HeroEmailCTA({ compact }: { compact: boolean }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<"idle" | "submitting" | "done">(() =>
    readStored() ? "done" : "idle"
  )
  const [email, setEmail] = useState("")
  const [savedEmail, setSavedEmail] = useState<string>(() => readStored()?.email ?? "")
  const [error, setError] = useState<string>("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (status === "submitting") return
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setError(t("home.hero.emailInvalid"))
      return
    }
    const url = resolveWaitlistUrl()
    if (!url) {
      setError(t("home.hero.waitlistUnavailable"))
      return
    }
    setStatus("submitting")
    setError("")
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      })
      if (!res.ok) throw new Error("waitlist responded not-ok")
      try {
        localStorage.setItem(
          WAITLIST_STORAGE_KEY,
          JSON.stringify({ v: 1, email: trimmed, ts: Date.now() })
        )
      } catch {
        // localStorage might be disabled; success state still applies for this session.
      }
      setSavedEmail(trimmed)
      setStatus("done")
    } catch {
      setStatus("idle")
      setError(t("home.hero.waitlistNetworkError"))
    }
  }

  function handleChange() {
    try {
      localStorage.removeItem(WAITLIST_STORAGE_KEY)
    } catch {
      // ignore
    }
    setSavedEmail("")
    setEmail("")
    setError("")
    setStatus("idle")
  }

  if (status === "done") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: "14px 16px",
          borderRadius: 16,
          background: "rgba(120, 200, 150, 0.16)",
          border: "1px solid rgba(80, 170, 120, 0.35)",
          maxWidth: 460,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            fontWeight: 600,
            color: "oklch(45% 0.14 150)",
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          {t("home.hero.waitlistSuccess")}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ripple-ink-soft)" }}>
          {t("home.hero.waitlistSuccessDetail", { email: savedEmail })}
        </div>
        <button
          type="button"
          onClick={handleChange}
          style={{
            alignSelf: "flex-start",
            marginTop: 4,
            background: "transparent",
            border: "none",
            padding: 0,
            fontFamily: "inherit",
            fontSize: 12,
            color: "var(--ripple-accent-strong)",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          {t("home.hero.waitlistChange")}
        </button>
      </div>
    )
  }

  const submitting = status === "submitting"

  return (
    <div style={{ maxWidth: 460 }}>
      <form
        onSubmit={handleSubmit}
        noValidate
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: 6,
          borderRadius: 14,
          background: "rgba(255,255,255,0.7)",
          border: "1px solid rgba(20,40,80,0.10)",
          flexWrap: compact ? "wrap" : "nowrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            paddingLeft: 8,
            flex: 1,
            minWidth: compact ? "100%" : 180,
          }}
        >
          <Mail size={16} style={{ color: "var(--ripple-ink-mute)", flexShrink: 0 }} />
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (error) setError("")
            }}
            placeholder={t(
              compact ? "home.hero.emailPlaceholderCompact" : "home.hero.emailPlaceholder"
            )}
            autoComplete="email"
            inputMode="email"
            aria-label={t("home.hero.emailPlaceholder")}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "waitlist-error" : undefined}
            disabled={submitting}
            className="waitlist-input"
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              background: "transparent",
              outline: "none",
              fontFamily: "inherit",
              fontSize: 13.5,
              color: "var(--ripple-ink)",
              padding: "8px 0",
            }}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: "none",
            background:
              "linear-gradient(135deg, var(--ripple-accent), var(--ripple-accent-strong))",
            color: "white",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 600,
            cursor: submitting ? "wait" : "pointer",
            opacity: submitting ? 0.7 : 1,
            whiteSpace: "nowrap",
            boxShadow: "0 6px 18px oklch(70% 0.2 235 / 0.35), inset 0 1px 0 rgba(255,255,255,0.3)",
            transition: "all 0.2s",
            width: compact ? "100%" : "auto",
          }}
        >
          {t(compact ? "home.hero.notifyButtonCompact" : "home.hero.notifyButton")}
        </button>
      </form>
      {error ? (
        <p
          id="waitlist-error"
          role="alert"
          style={{
            margin: "8px 0 0",
            fontSize: 12,
            color: "oklch(0.577 0.245 27.325)",
          }}
        >
          {error}
        </p>
      ) : (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 11.5,
            color: "var(--ripple-ink-mute)",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Lock size={11} aria-hidden="true" />
          {t("home.hero.notifyMeta")}
        </p>
      )}
    </div>
  )
}

function readViewport() {
  const w = typeof window === "undefined" ? 1280 : window.innerWidth
  return { w, mobile: w < 760, narrow: w < 1040 }
}

function useViewport() {
  const [v, setV] = useState(readViewport)
  useEffect(() => {
    const onResize = () => setV(readViewport())
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])
  return v
}

function ChromePuzzle({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13 3a2 2 0 1 1 4 0v2h3a1 1 0 0 1 1 1v3h2a2 2 0 1 1 0 4h-2v3a1 1 0 0 1-1 1h-3v2a2 2 0 1 1-4 0v-2H6a1 1 0 0 1-1-1v-4H3a2 2 0 1 1 0-4h2V6a1 1 0 0 1 1-1h7z" />
    </svg>
  )
}

function RippleMark({ size = 32 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        background: "linear-gradient(135deg, oklch(75% 0.10 220), oklch(50% 0.18 235))",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.5), 0 2px 6px oklch(50% 0.18 235 / 0.3)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <svg
        role="img"
        aria-label="Ripple logo"
        viewBox="0 0 24 24"
        width={size * 0.55}
        height={size * 0.55}
        fill="none"
        stroke="white"
        strokeWidth="1.4"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="3" opacity="0.9" />
        <circle cx="12" cy="12" r="6.5" opacity="0.55" />
        <circle cx="12" cy="12" r="10" opacity="0.3" />
      </svg>
    </div>
  )
}
