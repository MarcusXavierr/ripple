// @ts-expect-error — @fontsource packages have no type declarations
import "@fontsource/instrument-serif"
// import { StrictMode } from "react";
import { createRoot } from "react-dom/client"
import "./i18n"
import "./index.css"
import Router from "./router"

createRoot(document.getElementById("root")!).render(<Router />)
