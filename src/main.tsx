// @ts-expect-error — @fontsource packages have no type declarations
import "@fontsource/instrument-serif"
// import { StrictMode } from "react";
import { PostHogProvider } from "@posthog/react"
import { createRoot } from "react-dom/client"
import "./i18n"
import "./index.css"
import { ToastContainer } from "@/components/ui/toast"
import { posthogClient } from "@/lib/analytics"
import Router from "./router"

// INIT-ORDERING INVARIANT: importing "@/lib/analytics" runs posthog.init() at
// module load. Correctness depends on createRoot().render() remaining the LAST
// top-level statement here (no top-level await, no earlier render) so init
// completes before any track() from useCallSession. Do not reorder.
createRoot(document.getElementById("root")!).render(
  <PostHogProvider client={posthogClient}>
    <Router />
    <ToastContainer />
  </PostHogProvider>
)
