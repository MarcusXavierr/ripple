import { describe, expect, it, vi } from "vitest"

vi.mock("wxt/browser", () => ({ browser: { i18n: { getMessage: vi.fn(() => "") } } }))

import en from "../../public/_locales/en/messages.json"
import ptBR from "../../public/_locales/pt_BR/messages.json"
import { createTranslator } from "./t"

describe("createTranslator", () => {
  it("returns the browser translation for a known key", () => {
    const getMessage = vi.fn((key: string) => (key === "popup_title" ? "Ripple Control" : ""))

    const t = createTranslator({ getMessage })

    expect(t("popup_title")).toBe("Ripple Control")
    expect(getMessage).toHaveBeenCalledWith("popup_title", undefined)
  })

  it("throws when a key is missing", () => {
    const t = createTranslator({ getMessage: vi.fn(() => "") })

    expect(() => t("popup_title")).toThrow('Missing extension i18n message: "popup_title"')
  })
})

it("keeps locale message keys in sync", () => {
  expect(Object.keys(ptBR).sort()).toEqual(Object.keys(en).sort())
})
