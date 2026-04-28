import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { toast } from "@/components/ui/toast"
import { useCallStore } from "@/store/call"
import { useCallNotices } from "./useCallNotices"

vi.mock("@/components/ui/toast", () => ({
  toast: vi.fn(),
}))

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => `t:${key}` }),
}))

describe("useCallNotices", () => {
  afterEach(() => {
    useCallStore.getState().reset()
    vi.clearAllMocks()
  })

  it("dispatches toast with localized message and variant when notice set", () => {
    renderHook(() => useCallNotices())
    act(() => {
      useCallStore.setState({
        notice: { kind: "info", messageKey: "room.toast.computerAudioUnavailable" },
      })
    })
    expect(toast).toHaveBeenCalledWith("t:room.toast.computerAudioUnavailable", "info")
    expect(useCallStore.getState().notice).toBeNull()
  })

  it("clears notice from store after toasting", () => {
    renderHook(() => useCallNotices())
    act(() => {
      useCallStore.setState({
        notice: { kind: "warning", messageKey: "room.toast.computerAudioUnavailable" },
      })
    })

    expect(useCallStore.getState().notice).toBeNull()
  })

  it("does nothing when notice is null", () => {
    renderHook(() => useCallNotices())
    expect(toast).not.toHaveBeenCalled()
  })
})
