import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import en from "./locales/en/translation.json"
import ptBR from "./locales/pt-BR/translation.json"

const STORAGE_KEY = "ripple.lang"
const SUPPORTED = ["en", "pt-BR"] as const
type Lang = (typeof SUPPORTED)[number]

function loadInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && (SUPPORTED as readonly string[]).includes(saved)) return saved as Lang
  } catch {}
  return "en"
}

i18n.use(initReactI18next).init({
  lng: loadInitialLang(),
  fallbackLng: "en",
  resources: {
    en: { translation: en },
    "pt-BR": { translation: ptBR },
  },
  interpolation: { escapeValue: false },
})

i18n.on("languageChanged", (lng) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {}
})

export default i18n
