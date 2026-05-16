import { afterEach, expect, test, vi } from "vitest"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.doUnmock("posthog-js")
  vi.resetModules()
})

test("disabled + no init under test mode", async () => {
  const initSpy = vi.fn()
  vi.doMock("posthog-js", () => ({ default: { init: initSpy, capture: vi.fn() } }))
  vi.resetModules()
  const mod = await import("./client")
  expect(mod.isAnalyticsEnabled).toBe(false)
  expect(initSpy).not.toHaveBeenCalled()
})

test("enabled + init called with token + defaults when MODE!=test and token set", async () => {
  vi.stubEnv("MODE", "production")
  vi.stubEnv("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test")
  vi.stubEnv("VITE_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com")
  const initSpy = vi.fn()
  vi.doMock("posthog-js", () => ({ default: { init: initSpy, capture: vi.fn() } }))
  vi.resetModules()
  const mod = await import("./client")
  expect(mod.isAnalyticsEnabled).toBe(true)
  expect(initSpy).toHaveBeenCalledWith("phc_test", {
    api_host: "https://us.i.posthog.com",
    defaults: "2026-01-30",
  })
})
