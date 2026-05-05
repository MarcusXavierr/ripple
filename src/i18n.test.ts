import { afterEach, beforeEach } from "vitest"

const STORAGE_KEY = "ripple.lang"

describe("i18n language persistence", () => {
  beforeEach(() => {
    localStorage.clear()
    // Reset modules so each test re-evaluates loadInitialLang
    vi.resetModules()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it("writes the chosen language to localStorage when changed", async () => {
    const { default: i18n } = await import("./i18n")
    await i18n.changeLanguage("pt-BR")
    expect(localStorage.getItem(STORAGE_KEY)).toBe("pt-BR")
    await i18n.changeLanguage("en")
    expect(localStorage.getItem(STORAGE_KEY)).toBe("en")
  })

  it("seeds the initial language from localStorage on import", async () => {
    localStorage.setItem(STORAGE_KEY, "pt-BR")
    const { default: i18n } = await import("./i18n")
    expect(i18n.language).toBe("pt-BR")
  })

  it("falls back to en when no value is stored", async () => {
    const { default: i18n } = await import("./i18n")
    expect(i18n.language).toBe("en")
  })

  it("ignores unsupported language values", async () => {
    localStorage.setItem(STORAGE_KEY, "xx-YY")
    const { default: i18n } = await import("./i18n")
    expect(i18n.language).toBe("en")
  })
})
