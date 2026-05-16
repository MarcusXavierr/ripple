import { afterEach, expect, test, vi } from "vitest"

afterEach(() => {
  vi.doUnmock("./client")
  vi.resetModules()
})

test("track no-ops when disabled", async () => {
  vi.doMock("./client", () => ({
    isAnalyticsEnabled: false,
    posthogClient: { capture: vi.fn() },
  }))
  vi.resetModules()
  const { track } = await import("./analytics")
  expect(() => track("call_started", { roomId: "r1" })).not.toThrow()
})

test("track swallows capture errors", async () => {
  vi.doMock("./client", () => ({
    isAnalyticsEnabled: true,
    posthogClient: {
      capture: vi.fn(() => {
        throw new Error("boom")
      }),
    },
  }))
  vi.resetModules()
  const { track } = await import("./analytics")
  expect(() => track("call_started", { roomId: "r1" })).not.toThrow()
})

test("track forwards beacon option to posthog transport", async () => {
  const capture = vi.fn()
  vi.doMock("./client", () => ({ isAnalyticsEnabled: true, posthogClient: { capture } }))
  vi.resetModules()
  const { track } = await import("./analytics")
  track(
    "call_ended",
    { reason: "tab_closed", roomId: "r1", durationMs: 10, wasConnected: true },
    { beacon: true }
  )
  expect(capture).toHaveBeenCalledWith("call_ended", expect.any(Object), {
    transport: "sendBeacon",
    send_instantly: true,
  })
})
