import posthog from "posthog-js"

const token = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN as string | undefined
const host = import.meta.env.VITE_PUBLIC_POSTHOG_HOST as string | undefined

export const isAnalyticsEnabled = Boolean(token) && import.meta.env.MODE !== "test"

if (isAnalyticsEnabled) {
  posthog.init(token as string, {
    api_host: host,
    defaults: "2026-01-30",
  })
}

export const posthogClient = posthog
