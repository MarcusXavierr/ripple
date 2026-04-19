// @ts-ignore — @fontsource packages have no type declarations
import "@fontsource/instrument-serif"
// import { StrictMode } from "react";
import { createRoot } from "react-dom/client"
import "./i18n"
import "./index.css"
import Router from "./router"

// biome-ignore lint/style/noNonNullAssertion: root element guaranteed by index.html
createRoot(document.getElementById("root")!).render(<Router />)
