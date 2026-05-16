import { beforeEach, expect, test, vi } from "vitest"
import { useCallStore } from "@/store/call"
import type { MediaController } from "./MediaController"
import type { PeerConnection } from "./PeerConnection"
import type { SignalingChannel } from "./SignalingChannel"
import { SignalingMachine } from "./SignalingMachine"

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  isAnalyticsEnabled: false,
  posthogClient: { capture: vi.fn() },
}))

function makeMachine(extra: Partial<{ onConnected: () => void }> = {}) {
  return new SignalingMachine({
    pc: {
      setup: vi.fn(),
      raw: {},
      rollbackAndRestartIce: vi.fn(),
    } as unknown as PeerConnection,
    ws: { send: vi.fn() } as unknown as SignalingChannel,
    media: { attachPC: vi.fn() } as unknown as MediaController,
    store: useCallStore,
    navigate: vi.fn(),
    onConnected: extra.onConnected,
  })
}

beforeEach(() => {
  useCallStore.getState().reset()
})

test("onConnected fires on NEGOTIATING->CONNECTED, again after ICE-restart re-entry", async () => {
  const onConnected = vi.fn()
  const machine = makeMachine({ onConnected })

  await machine.send({ type: "onopen", role: "caller", reconnect: false })
  await machine.send({ type: "enter" })
  await machine.send({ type: "ice-connected" })
  await machine.send({ type: "ice-failed" })
  await machine.send({ type: "ice-connected" })

  expect(onConnected).toHaveBeenCalledTimes(2)
})
