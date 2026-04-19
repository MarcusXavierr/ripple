import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import en from "./locales/en/translation.json"
import ptBR from "./locales/pt-BR/translation.json"

i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: { translation: en },
    "pt-BR": { translation: ptBR },
  },
  interpolation: { escapeValue: false },
})

export default i18n
