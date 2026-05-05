import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

const FONT_LINK_ID = "ripple-instrument-serif-link"
const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif&display=swap"

function ensureFontLink() {
  if (typeof document === "undefined") return
  if (document.getElementById(FONT_LINK_ID)) return
  // Skip if any link already points at the same href
  const existing = document.head.querySelector<HTMLLinkElement>(
    `link[rel="stylesheet"][href*="Instrument+Serif"]`
  )
  if (existing) return
  const link = document.createElement("link")
  link.id = FONT_LINK_ID
  link.rel = "stylesheet"
  link.href = FONT_HREF
  document.head.appendChild(link)
}

const SECTION_IDS = [
  "stores",
  "network",
  "notCollect",
  "permissions",
  "control",
  "crossOrigin",
  "security",
  "contact",
] as const
type SectionId = (typeof SECTION_IDS)[number]

const SECTION_NUMBERS: Record<SectionId, string> = {
  stores: "01",
  network: "02",
  notCollect: "03",
  permissions: "04",
  control: "05",
  crossOrigin: "06",
  security: "07",
  contact: "08",
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [query])
  return matches
}

function RippleMark({ size = 28 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: "linear-gradient(135deg, oklch(75% 0.10 220), oklch(50% 0.18 235))",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.5), 0 2px 6px oklch(50% 0.18 235 / 0.3)",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.55}
        height={size * 0.55}
        fill="none"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3" opacity="0.9" />
        <circle cx="12" cy="12" r="6.5" opacity="0.55" />
        <circle cx="12" cy="12" r="10" opacity="0.3" />
      </svg>
    </div>
  )
}

function ChevronLeftIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="14"
      height="14"
      aria-hidden="true"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  )
}

function ShieldCheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path d="M12 2 4 5v7c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5l-8-3z" />
      <polyline points="9 12 11.5 14.5 16 10" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="15"
      height="15"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="15"
      height="15"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

type DataRow = { key: string; val: React.ReactNode }

function DataTable({ rows }: { rows: DataRow[] }) {
  return (
    <div
      className="glass"
      style={{
        borderRadius: 16,
        overflow: "hidden",
        margin: "16px 0",
      }}
    >
      {rows.map((row, i) => (
        <div
          key={row.key}
          className="ripple-data-row"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.4fr",
            gap: 0,
            padding: "14px 18px",
            borderBottom: i === rows.length - 1 ? "none" : "1px solid rgba(20,40,80,0.06)",
            alignItems: "start",
            background: "rgba(255,255,255,0.5)",
          }}
        >
          <div
            className="ripple-data-key"
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--ripple-ink)",
              paddingRight: 12,
            }}
          >
            {row.key}
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: "var(--ripple-ink-soft)",
              lineHeight: 1.5,
            }}
          >
            {row.val}
          </div>
        </div>
      ))}
    </div>
  )
}

function BadgeBrowserOnly({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 6,
        background: "oklch(95% 0.04 230 / 0.5)",
        color: "oklch(48% 0.18 230)",
        fontSize: 10.5,
        fontWeight: 600,
        marginRight: 6,
      }}
    >
      {label}
    </span>
  )
}

function SectionHead({ id, title }: { id: SectionId; title: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          background: "oklch(92% 0.04 230)",
          color: "oklch(48% 0.18 230)",
          fontSize: 11,
          fontWeight: 700,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        {SECTION_NUMBERS[id]}
      </div>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: "var(--ripple-ink)",
          margin: 0,
        }}
      >
        {title}
      </h2>
    </div>
  )
}

function Section({
  id,
  title,
  children,
  refSetter,
}: {
  id: SectionId
  title: string
  children: React.ReactNode
  refSetter: (id: SectionId, el: HTMLDivElement | null) => void
}) {
  return (
    <div ref={(el) => refSetter(id, el)} id={id} style={{ marginBottom: 48, scrollMarginTop: 100 }}>
      <SectionHead id={id} title={title} />
      <div
        style={{
          fontSize: 14.5,
          lineHeight: 1.7,
          color: "var(--ripple-ink-soft)",
        }}
      >
        {children}
      </div>
    </div>
  )
}

function Callout({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className="glass"
      style={{
        padding: "18px 20px",
        borderRadius: 16,
        margin: "18px 0",
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
      }}
    >
      <span
        style={{
          flexShrink: 0,
          marginTop: 1,
          color: "oklch(48% 0.18 230)",
        }}
      >
        {icon}
      </span>
      <p
        style={{
          margin: 0,
          fontSize: 13.5,
          lineHeight: 1.55,
          color: "var(--ripple-ink-soft)",
        }}
      >
        {children}
      </p>
    </div>
  )
}

export default function Privacy() {
  const { t } = useTranslation()
  const contactEmail = import.meta.env.VITE_CONTACT_EMAIL ?? ""
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [activeSection, setActiveSection] = useState<SectionId>("stores")
  const wide = useMediaQuery("(min-width: 1060px)")
  const mobile = useMediaQuery("(max-width: 640px)")

  useEffect(() => {
    ensureFontLink()
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id as SectionId)
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px" }
    )
    for (const id of SECTION_IDS) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  const scrollTo = (id: SectionId) => {
    const el = document.getElementById(id)
    if (!el) return
    const y = el.getBoundingClientRect().top + window.scrollY - 100
    window.scrollTo({ top: y, behavior: "smooth" })
  }

  const setRef = (id: SectionId, el: HTMLDivElement | null) => {
    sectionRefs.current[id] = el
  }

  const heroFontSize = mobile ? 38 : 58
  const heroPadding = mobile ? "32px 0 32px" : "52px 0 48px"
  const heroSubSize = mobile ? 14 : 16
  const sectionBodySize = mobile ? 13.5 : 14.5

  const browserOnlyLabel = t("privacy.badges.browserOnly")

  // Local CSS overrides scoped via a unique class on the root.
  // Mobile collapses the data-table grid to a single column.
  const responsiveCss = `
    .ripple-privacy-root { --ripple-hue-local: 230; }
    @media (max-width: 640px) {
      .ripple-privacy-root .ripple-data-row { grid-template-columns: 1fr !important; gap: 6px !important; }
      .ripple-privacy-root .ripple-data-key { padding-right: 0 !important; }
      .ripple-privacy-root .ripple-contact-card { flex-direction: column !important; gap: 16px !important; align-items: flex-start !important; }
      .ripple-privacy-root .ripple-contact-btn { width: 100%; text-align: center; }
      .ripple-privacy-root .ripple-principles { grid-template-columns: 1fr !important; }
    }
  `

  return (
    <div
      className="ripple-privacy-root"
      style={{
        position: "relative",
        minHeight: "100vh",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
        color: "var(--ripple-ink)",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <style>{responsiveCss}</style>

      {/* Stage gradient (fixed) */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background: `
            radial-gradient(ellipse 60% 50% at 12% 18%, oklch(94% 0.04 220 / 0.85), transparent 65%),
            radial-gradient(ellipse 50% 55% at 88% 20%, oklch(93% 0.05 235 / 0.8), transparent 65%),
            radial-gradient(ellipse 60% 45% at 85% 90%, oklch(94% 0.04 200 / 0.7), transparent 65%),
            linear-gradient(135deg, #f4f8fc 0%, #eef3f9 50%, #f1f6fb 100%)
          `,
          zIndex: 0,
        }}
      />

      {/* White highlight overlay (matches Home stage::after) */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: `
            radial-gradient(circle at 25% 25%, rgba(255,255,255,0.3) 0%, transparent 30%),
            radial-gradient(circle at 75% 75%, rgba(255,255,255,0.2) 0%, transparent 30%)
          `,
          zIndex: 0,
        }}
      />

      {/* Drifting blobs */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          width: 420,
          height: 420,
          borderRadius: "50%",
          background: "oklch(80% 0.10 220)",
          filter: "blur(80px)",
          opacity: 0.28,
          top: -120,
          left: -100,
          zIndex: 0,
          animation: "ripple-drift 24s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          width: 380,
          height: 380,
          borderRadius: "50%",
          background: "oklch(82% 0.08 235)",
          filter: "blur(80px)",
          opacity: 0.28,
          top: "30%",
          right: -140,
          zIndex: 0,
          animation: "ripple-drift 24s ease-in-out infinite",
          animationDelay: "-8s",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          width: 340,
          height: 340,
          borderRadius: "50%",
          background: "oklch(85% 0.07 200)",
          filter: "blur(80px)",
          opacity: 0.28,
          bottom: -120,
          left: "35%",
          zIndex: 0,
          animation: "ripple-drift 24s ease-in-out infinite",
          animationDelay: "-16s",
          pointerEvents: "none",
        }}
      />

      {/* Nav band */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: "0 32px",
        }}
      >
        <div
          style={{
            maxWidth: 1020,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 0",
          }}
        >
          <Link
            to="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 15,
              fontWeight: 600,
              color: "var(--ripple-ink)",
              letterSpacing: "-0.01em",
              textDecoration: "none",
            }}
          >
            <RippleMark size={28} />
            {t("nav.brand")}
          </Link>
          <Link
            to="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 500,
              color: "var(--ripple-ink-soft)",
              padding: "8px 14px",
              borderRadius: 999,
              textDecoration: "none",
              transition: "all 0.15s",
            }}
          >
            <ChevronLeftIcon />
            {t("privacy.nav.back")}
          </Link>
        </div>
      </div>

      {/* Layout grid */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: wide ? "grid" : "block",
          gridTemplateColumns: wide ? "minmax(0, 700px) 220px" : undefined,
          gap: wide ? 52 : undefined,
          maxWidth: wide ? 1020 : 780,
          margin: "0 auto",
          padding: wide ? "0 32px 80px" : mobile ? "0 18px 60px" : "0 24px 80px",
          alignItems: "start",
        }}
      >
        <div>
          {/* Hero */}
          <div style={{ padding: heroPadding }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 12px 5px 8px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.55)",
                border: "1px solid rgba(255,255,255,0.7)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                fontSize: 11,
                color: "var(--ripple-ink-soft)",
                fontWeight: 500,
                boxShadow: "0 2px 10px rgba(20,40,80,0.06)",
                marginBottom: 22,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "oklch(72% 0.14 200)",
                  boxShadow: "0 0 0 3px oklch(72% 0.14 200 / 0.25)",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              {t("privacy.hero.label")}
            </div>
            <h1
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontSize: heroFontSize,
                lineHeight: 1.0,
                fontWeight: 400,
                color: "var(--ripple-ink)",
                margin: "0 0 18px",
                letterSpacing: "-0.02em",
                textWrap: "balance",
              }}
            >
              {t("privacy.hero.titleA")}
              <br />
              <em
                style={{
                  fontStyle: "italic",
                  color: "oklch(48% 0.18 230)",
                }}
              >
                {t("privacy.hero.titleEm")}
              </em>
            </h1>
            <p
              style={{
                fontSize: heroSubSize,
                lineHeight: 1.6,
                color: "var(--ripple-ink-soft)",
                maxWidth: 520,
                margin: 0,
              }}
            >
              {t("privacy.hero.sub")}
            </p>
            <div
              style={{
                marginTop: 20,
                fontSize: 12,
                color: "var(--ripple-ink-mute)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "block",
                  width: 16,
                  height: 1,
                  background: "currentColor",
                  opacity: 0.4,
                }}
              />
              {t("privacy.hero.updated")}
            </div>
          </div>

          {/* Principles row */}
          <div
            className="ripple-principles"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              marginBottom: mobile ? 40 : 56,
            }}
          >
            {[
              { icon: <LockIcon />, key: "local" },
              { icon: <EyeOffIcon />, key: "noTel" },
              { icon: <ShieldCheckIcon />, key: "perSite" },
            ].map(({ icon, key }) => (
              <div
                key={key}
                className="glass"
                style={{
                  padding: "22px 20px",
                  borderRadius: 20,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 11,
                    display: "grid",
                    placeItems: "center",
                    background: "oklch(92% 0.04 230)",
                    color: "oklch(48% 0.18 230)",
                    marginBottom: 14,
                  }}
                >
                  {icon}
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: "var(--ripple-ink)",
                    marginBottom: 6,
                  }}
                >
                  {t(`privacy.principles.${key}.title`)}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: 1.55,
                    color: "var(--ripple-ink-mute)",
                  }}
                >
                  {t(`privacy.principles.${key}.body`)}
                </div>
              </div>
            ))}
          </div>

          {/* Section 01 — Stores */}
          <Section id="stores" title={t("privacy.sections.stores.title")} refSetter={setRef}>
            <p style={{ margin: "0 0 14px", fontSize: sectionBodySize }}>
              {t("privacy.sections.stores.intro")}
            </p>
            <DataTable
              rows={[
                {
                  key: t("privacy.sections.stores.rows.ids.key"),
                  val: (
                    <>
                      <BadgeBrowserOnly label={browserOnlyLabel} />
                      {t("privacy.sections.stores.rows.ids.val")}
                    </>
                  ),
                },
                {
                  key: t("privacy.sections.stores.rows.url.key"),
                  val: (
                    <>
                      <BadgeBrowserOnly label={browserOnlyLabel} />
                      {t("privacy.sections.stores.rows.url.val")}
                    </>
                  ),
                },
                {
                  key: t("privacy.sections.stores.rows.hosts.key"),
                  val: (
                    <>
                      <BadgeBrowserOnly label={browserOnlyLabel} />
                      {t("privacy.sections.stores.rows.hosts.val")}
                    </>
                  ),
                },
              ]}
            />
            <p style={{ margin: 0, fontSize: sectionBodySize }}>
              {t("privacy.sections.stores.outro")}
            </p>
          </Section>

          {/* Section 02 — Network */}
          <Section id="network" title={t("privacy.sections.network.title")} refSetter={setRef}>
            <p style={{ margin: "0 0 14px", fontSize: sectionBodySize }}>
              {t("privacy.sections.network.intro")}
            </p>
            <Callout icon={<InfoIcon />}>
              <strong style={{ color: "var(--ripple-ink)", fontWeight: 600 }}>
                {t("privacy.sections.network.callout")}
              </strong>{" "}
              {t("privacy.sections.network.body")}
            </Callout>
            <p style={{ margin: 0, fontSize: sectionBodySize }}>
              {t("privacy.sections.network.outro")}
            </p>
          </Section>

          {/* Section 03 — Not collect */}
          <Section
            id="notCollect"
            title={t("privacy.sections.notCollect.title")}
            refSetter={setRef}
          >
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                fontSize: sectionBodySize,
              }}
            >
              {(
                t("privacy.sections.notCollect.items", {
                  returnObjects: true,
                }) as string[]
              ).map((item) => (
                <li
                  key={item}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    padding: "8px 0",
                  }}
                >
                  <span
                    style={{
                      color: "oklch(48% 0.18 230)",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    <CheckIcon />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Section 04 — Permissions */}
          <Section
            id="permissions"
            title={t("privacy.sections.permissions.title")}
            refSetter={setRef}
          >
            <DataTable
              rows={(
                ["activeTab", "scripting", "storage", "tabs", "hosts", "extConn"] as const
              ).map((permKey) => ({
                key: t(`privacy.sections.permissions.rows.${permKey}.key`),
                val: t(`privacy.sections.permissions.rows.${permKey}.val`),
              }))}
            />
          </Section>

          {/* Section 05 — Control */}
          <Section id="control" title={t("privacy.sections.control.title")} refSetter={setRef}>
            <p style={{ margin: "0 0 14px", fontSize: sectionBodySize }}>
              {t("privacy.sections.control.body")}
            </p>
            <Callout icon={<InfoIcon />}>{t("privacy.sections.control.callout")}</Callout>
          </Section>

          {/* Section 06 — Cross origin */}
          <Section
            id="crossOrigin"
            title={t("privacy.sections.crossOrigin.title")}
            refSetter={setRef}
          >
            <p style={{ margin: 0, fontSize: sectionBodySize }}>
              {t("privacy.sections.crossOrigin.body")}
            </p>
          </Section>

          {/* Section 07 — Security */}
          <Section id="security" title={t("privacy.sections.security.title")} refSetter={setRef}>
            <p style={{ margin: 0, fontSize: sectionBodySize }}>
              {t("privacy.sections.security.body")}
            </p>
          </Section>

          {/* Divider */}
          <div
            style={{
              height: 1,
              background: "rgba(20,40,80,0.07)",
              margin: "40px 0",
            }}
          />

          {/* Contact card (Section 08) */}
          <div
            ref={(el) => setRef("contact", el)}
            id="contact"
            className="glass-strong ripple-contact-card"
            style={{
              padding: "28px 30px",
              borderRadius: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 24,
              flexWrap: "wrap",
              scrollMarginTop: 100,
            }}
          >
            <div>
              <h3
                style={{
                  margin: "0 0 4px",
                  fontSize: mobile ? 15 : 16,
                  fontWeight: 600,
                  color: "var(--ripple-ink)",
                }}
              >
                {t("privacy.sections.contact.title")}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "var(--ripple-ink-mute)",
                }}
              >
                {t("privacy.sections.contact.body", { email: contactEmail })}
              </p>
            </div>
            <a
              href={`mailto:${contactEmail}`}
              className="ripple-contact-btn"
              style={{
                padding: "11px 22px",
                borderRadius: 12,
                border: "none",
                background: "oklch(58% 0.16 230)",
                color: "white",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                boxShadow: "0 4px 14px oklch(58% 0.16 230 / 0.32)",
                transition: "all 0.2s",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              {t("privacy.sections.contact.cta")}
            </a>
          </div>

          {/* Footer */}
          <footer
            style={{
              marginTop: 40,
              padding: "20px 0",
              borderTop: "1px solid rgba(20,40,80,0.07)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 11.5,
              color: "var(--ripple-ink-mute)",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div>{t("privacy.footer.copyright")}</div>
          </footer>
        </div>

        {/* ToC sidebar */}
        {wide && (
          <nav
            aria-label={t("privacy.toc.title")}
            className="glass"
            style={{
              position: "sticky",
              top: 120,
              height: "fit-content",
              padding: 20,
              borderRadius: 18,
              alignSelf: "start",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--ripple-ink-mute)",
                marginBottom: 12,
              }}
            >
              {t("privacy.toc.title")}
            </div>
            {SECTION_IDS.map((id) => {
              const active = activeSection === id
              return (
                <button
                  type="button"
                  key={id}
                  onClick={() => scrollTo(id)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    fontSize: 12,
                    color: active ? "oklch(48% 0.18 230)" : "var(--ripple-ink-mute)",
                    padding: "5px 0 5px 10px",
                    marginLeft: -10,
                    background: "transparent",
                    border: "none",
                    borderLeft: `2px solid ${active ? "oklch(58% 0.16 230)" : "transparent"}`,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: active ? 500 : 400,
                    transition: "all 0.15s",
                  }}
                >
                  {t(`privacy.sections.${id}.title`)}
                </button>
              )
            })}
          </nav>
        )}
      </div>
    </div>
  )
}
