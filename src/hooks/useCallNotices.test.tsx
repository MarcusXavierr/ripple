import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import { useCallStore } from "@/store/call"
import { useCallNotices } from "./useCallNotices"

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), warning: vi.fn() },
}))

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => `t:${key}` }),
}))

describe("useCallNotices", () => {
  afterEach(() => {
    useCallStore.getState().reset()
    vi.clearAllMocks()
  })

  it("fires a toast and clears the notice when one is set", () => {
    renderHook(() => useCallNotices())
    act(() => {
      useCallStore.setState({ notice: { kind: "info", messageKey: "room.toast.computerAudioUnavailable" } })
    })
    expect(toast.info).toHaveBeenCalledWith("t:room.toast.computerAudioUnavailable")
    expect(useCallStore.getState().notice).toBeNull()
  })

  it("does nothing when notice is null", () => {
    renderHook(() => useCallNotices())
    expect(toast.info).not.toHaveBeenCalled()
  })
})
