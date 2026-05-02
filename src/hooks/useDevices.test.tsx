import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useCallStore } from "@/store/call"
import { useDevices } from "./useDevices"

type MockMediaDevice = {
  deviceId: string
  kind: MediaDeviceKind
  label: string
}

const enumerateDevices = vi.fn<() => Promise<MockMediaDevice[]>>()
const addEventListener = vi.fn()
const removeEventListener = vi.fn()
const getUserMedia = vi.fn()
const replaceTrack = vi.fn()

let deviceChangeListener: (() => void | Promise<void>) | null = null

function createDevice(kind: MediaDeviceKind, deviceId: string, label: string): MockMediaDevice {
  return { kind, deviceId, label }
}

function createStream(audioId?: string, videoId?: string): MediaStream {
  return {
    getAudioTracks: vi.fn(() =>
      audioId
        ? [
            {
              getSettings: () => ({ deviceId: audioId }),
            } as MediaStreamTrack,
          ]
        : []
    ),
    getVideoTracks: vi.fn(() =>
      videoId
        ? [
            {
              getSettings: () => ({ deviceId: videoId }),
            } as MediaStreamTrack,
          ]
        : []
    ),
    getTracks: vi.fn(() => []),
  } as unknown as MediaStream
}

function renderUseDevices(options?: {
  mediaController?: { replaceTrack: typeof replaceTrack } | null
  localStream?: MediaStream | null
}) {
  const localStream = options?.localStream ?? createStream("mic-1", "cam-1")
  const mediaController = options?.mediaController ?? null

  return renderHook(() => useDevices({ mediaController: mediaController as never, localStream }))
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useCallStore.getState().reset()
  deviceChangeListener = null
  enumerateDevices.mockResolvedValue([
    createDevice("audioinput", "mic-1", "Mic 1"),
    createDevice("videoinput", "cam-1", "Cam 1"),
    createDevice("audiooutput", "speaker-1", "Speaker 1"),
  ])
  addEventListener.mockImplementation((event: string, listener: () => void) => {
    if (event === "devicechange") {
      deviceChangeListener = listener
    }
  })
  removeEventListener.mockImplementation((event: string, listener: () => void) => {
    if (event === "devicechange" && deviceChangeListener === listener) {
      deviceChangeListener = null
    }
  })
  getUserMedia.mockResolvedValue({
    getTracks: () => [{ stop: vi.fn() }, { stop: vi.fn() }],
  } as unknown as MediaStream)
  replaceTrack.mockResolvedValue(undefined)
  Object.defineProperty(navigator, "mediaDevices", {
    value: {
      enumerateDevices,
      addEventListener,
      removeEventListener,
      getUserMedia,
    },
    configurable: true,
  })
  Object.defineProperty(HTMLMediaElement.prototype, "setSinkId", {
    value: vi.fn(),
    configurable: true,
  })
})

describe("useDevices", () => {
  it("partitions enumerateDevices output by kind", async () => {
    const { result } = renderUseDevices()

    await waitFor(() => {
      expect(result.current.devices).toEqual({
        mic: [{ id: "mic-1", label: "Mic 1" }],
        cam: [{ id: "cam-1", label: "Cam 1" }],
        speaker: [{ id: "speaker-1", label: "Speaker 1" }],
      })
    })
  })

  it("selectDevice('mic') calls replaceTrack and updates selected", async () => {
    const { result } = renderUseDevices({
      mediaController: { replaceTrack },
    })

    await waitFor(() => {
      expect(result.current.selected.mic).toBe("mic-1")
    })

    await act(async () => {
      await result.current.selectDevice("mic", "mic-2")
    })

    expect(replaceTrack).toHaveBeenCalledWith("mic", "mic-2")
    expect(result.current.selected.mic).toBe("mic-2")
  })

  it("selectDevice('speaker') updates selected and persists without touching the DOM", async () => {
    const { result } = renderUseDevices()

    await waitFor(() => {
      expect(result.current.selected.speaker).toBe("speaker-1")
    })

    await act(async () => {
      await result.current.selectDevice("speaker", "speaker-2")
    })

    expect(result.current.selected.speaker).toBe("speaker-2")
    expect(localStorage.getItem("ripple.devices.speaker")).toBe("speaker-2")
  })

  it("speaker selection persists in localStorage", async () => {
    const { result } = renderUseDevices()

    await act(async () => {
      await result.current.selectDevice("speaker", "speaker-1")
    })

    expect(localStorage.getItem("ripple.devices.speaker")).toBe("speaker-1")
  })

  it("initial selected mic/cam ids come from localStream track settings, not directly from localStorage", async () => {
    localStorage.setItem("ripple.devices.mic", "mic-old")
    localStorage.setItem("ripple.devices.cam", "cam-old")

    const { result } = renderUseDevices()

    await waitFor(() => {
      expect(result.current.selected.mic).toBe("mic-1")
      expect(result.current.selected.cam).toBe("cam-1")
    })
  })

  it("restores last-selected mic on next mount when device still present", async () => {
    localStorage.setItem("ripple.devices.mic", "mic-2")
    enumerateDevices.mockResolvedValue([
      createDevice("audioinput", "mic-1", "Mic 1"),
      createDevice("audioinput", "mic-2", "Mic 2"),
      createDevice("videoinput", "cam-1", "Cam 1"),
      createDevice("audiooutput", "speaker-1", "Speaker 1"),
    ])

    const { result } = renderUseDevices({
      localStream: createStream(undefined, "cam-1"),
    })

    await waitFor(() => {
      expect(result.current.selected.mic).toBe("mic-2")
    })
  })

  it("falls back to default when persisted id is no longer present", async () => {
    localStorage.setItem("ripple.devices.mic", "mic-missing")

    const { result } = renderUseDevices({
      localStream: createStream(undefined, "cam-1"),
    })

    await waitFor(() => {
      expect(result.current.selected.mic).toBe("mic-1")
    })
  })

  it("speakerSupported is false when setSinkId missing", async () => {
    delete (HTMLMediaElement.prototype as { setSinkId?: unknown }).setSinkId

    const { result } = renderUseDevices()

    await waitFor(() => {
      expect(result.current.speakerSupported).toBe(false)
    })
  })

  it("permissionGranted is false when all device labels are empty", async () => {
    enumerateDevices.mockResolvedValue([
      createDevice("audioinput", "mic-1", ""),
      createDevice("videoinput", "cam-1", ""),
      createDevice("audiooutput", "speaker-1", ""),
    ])

    const { result } = renderUseDevices()

    await waitFor(() => {
      expect(result.current.permissionGranted).toBe(false)
    })
  })

  it("requestPermission triggers getUserMedia and re-enumerates", async () => {
    const { result } = renderUseDevices()

    await act(async () => {
      await result.current.requestPermission()
    })

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: true })
    expect(enumerateDevices).toHaveBeenCalledTimes(2)
  })

  it("devicechange event re-enumerates and falls back when active mic vanishes", async () => {
    const { result } = renderUseDevices({
      mediaController: { replaceTrack },
      localStream: createStream("mic-2", "cam-1"),
    })

    await waitFor(() => {
      expect(result.current.selected.mic).toBe("mic-1")
    })

    await act(async () => {
      await result.current.selectDevice("mic", "mic-2")
    })

    enumerateDevices.mockResolvedValue([
      createDevice("audioinput", "mic-1", "Mic 1"),
      createDevice("videoinput", "cam-1", "Cam 1"),
      createDevice("audiooutput", "speaker-1", "Speaker 1"),
    ])

    await act(async () => {
      await deviceChangeListener?.()
    })

    expect(replaceTrack).toHaveBeenLastCalledWith("mic", "mic-1")
  })

  it("devicechange fallback for camera invokes replaceTrack with the fallback id", async () => {
    enumerateDevices.mockResolvedValue([
      createDevice("audioinput", "mic-1", "Mic 1"),
      createDevice("videoinput", "cam-1", "Cam 1"),
      createDevice("videoinput", "cam-2", "Cam 2"),
      createDevice("audiooutput", "speaker-1", "Speaker 1"),
    ])
    const { result } = renderUseDevices({
      mediaController: { replaceTrack },
      localStream: createStream("mic-1", "cam-2"),
    })

    await act(async () => {
      await result.current.selectDevice("cam", "cam-2")
    })

    enumerateDevices.mockResolvedValue([
      createDevice("audioinput", "mic-1", "Mic 1"),
      createDevice("videoinput", "cam-1", "Cam 1"),
      createDevice("audiooutput", "speaker-1", "Speaker 1"),
    ])

    await act(async () => {
      await deviceChangeListener?.()
    })

    expect(replaceTrack).toHaveBeenLastCalledWith("cam", "cam-1")
  })

  it("devicechange fallback for speaker updates selected.speaker to the fallback id", async () => {
    enumerateDevices.mockResolvedValue([
      createDevice("audioinput", "mic-1", "Mic 1"),
      createDevice("videoinput", "cam-1", "Cam 1"),
      createDevice("audiooutput", "speaker-1", "Speaker 1"),
      createDevice("audiooutput", "speaker-2", "Speaker 2"),
    ])
    const { result } = renderUseDevices()

    await act(async () => {
      await result.current.selectDevice("speaker", "speaker-2")
    })

    enumerateDevices.mockResolvedValue([
      createDevice("audioinput", "mic-1", "Mic 1"),
      createDevice("videoinput", "cam-1", "Cam 1"),
      createDevice("audiooutput", "speaker-1", "Speaker 1"),
    ])

    await act(async () => {
      await deviceChangeListener?.()
    })

    expect(result.current.selected.speaker).toBe("speaker-1")
  })

  it("devicechange dispatches a warning notice after fallback", async () => {
    enumerateDevices.mockResolvedValue([
      createDevice("audioinput", "mic-1", "Mic 1"),
      createDevice("audioinput", "mic-2", "Mic 2"),
      createDevice("videoinput", "cam-1", "Cam 1"),
      createDevice("audiooutput", "speaker-1", "Speaker 1"),
    ])
    const { result } = renderUseDevices({
      mediaController: { replaceTrack },
    })

    await act(async () => {
      await result.current.selectDevice("mic", "mic-2")
    })

    enumerateDevices.mockResolvedValue([
      createDevice("audioinput", "mic-1", "Mic 1"),
      createDevice("videoinput", "cam-1", "Cam 1"),
      createDevice("audiooutput", "speaker-1", "Speaker 1"),
    ])

    await act(async () => {
      await deviceChangeListener?.()
    })

    expect(useCallStore.getState().notice).toEqual({
      kind: "warning",
      messageKey: "room.toast.deviceUnplugged",
    })
  })

  it("devicechange fallback does not dispatch the normal mic-changed success notice", async () => {
    enumerateDevices.mockResolvedValue([
      createDevice("audioinput", "mic-1", "Mic 1"),
      createDevice("audioinput", "mic-2", "Mic 2"),
      createDevice("videoinput", "cam-1", "Cam 1"),
      createDevice("audiooutput", "speaker-1", "Speaker 1"),
    ])
    const { result } = renderUseDevices({
      mediaController: { replaceTrack },
    })

    await act(async () => {
      await result.current.selectDevice("mic", "mic-2")
    })

    const setStateSpy = vi.spyOn(useCallStore, "setState")
    enumerateDevices.mockResolvedValue([
      createDevice("audioinput", "mic-1", "Mic 1"),
      createDevice("videoinput", "cam-1", "Cam 1"),
      createDevice("audiooutput", "speaker-1", "Speaker 1"),
    ])

    await act(async () => {
      await deviceChangeListener?.()
    })

    expect(
      setStateSpy.mock.calls.some(
        ([arg]) =>
          typeof arg === "object" &&
          arg !== null &&
          "notice" in arg &&
          arg.notice?.messageKey === "room.toast.micChanged"
      )
    ).toBe(false)
  })

  it("devicechange fallback clears selection and dispatches fatal notice when fallback replacement fails", async () => {
    enumerateDevices.mockResolvedValue([
      createDevice("audioinput", "mic-1", "Mic 1"),
      createDevice("audioinput", "mic-2", "Mic 2"),
      createDevice("videoinput", "cam-1", "Cam 1"),
      createDevice("audiooutput", "speaker-1", "Speaker 1"),
    ])
    const { result } = renderUseDevices({
      mediaController: { replaceTrack },
    })

    await act(async () => {
      await result.current.selectDevice("mic", "mic-2")
    })

    replaceTrack.mockRejectedValueOnce(new Error("fallback failed"))
    enumerateDevices.mockResolvedValue([
      createDevice("audioinput", "mic-1", "Mic 1"),
      createDevice("videoinput", "cam-1", "Cam 1"),
      createDevice("audiooutput", "speaker-1", "Speaker 1"),
    ])

    await act(async () => {
      await deviceChangeListener?.()
    })

    expect(result.current.selected.mic).toBe("")
    expect(useCallStore.getState().notice).toEqual({
      kind: "warning",
      messageKey: "room.toast.deviceUnpluggedFatal",
    })
  })

  it("in-flight switch debounces additional selectDevice calls", async () => {
    let resolveSwitch!: () => void
    replaceTrack.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveSwitch = resolve
        })
    )
    const { result } = renderUseDevices({
      mediaController: { replaceTrack },
    })

    let first!: Promise<void>
    let second!: Promise<void>
    act(() => {
      first = result.current.selectDevice("mic", "mic-2")
      second = result.current.selectDevice("mic", "mic-3")
    })

    expect(first).toBe(second)
    resolveSwitch()
    await act(async () => {
      await first
    })
    expect(replaceTrack).toHaveBeenCalledTimes(1)
  })

  it("speaker selection does not leave selectDevice stuck in-flight for the next mic change", async () => {
    enumerateDevices.mockResolvedValue([
      createDevice("audioinput", "mic-1", "Mic 1"),
      createDevice("audioinput", "mic-2", "Mic 2"),
      createDevice("videoinput", "cam-1", "Cam 1"),
      createDevice("audiooutput", "speaker-1", "Speaker 1"),
      createDevice("audiooutput", "speaker-2", "Speaker 2"),
    ])
    const { result } = renderUseDevices({
      mediaController: { replaceTrack },
      localStream: createStream("mic-1", "cam-1"),
    })

    await waitFor(() => {
      expect(result.current.selected.speaker).toBe("speaker-1")
    })

    await act(async () => {
      await result.current.selectDevice("speaker", "speaker-2")
    })

    await act(async () => {
      await result.current.selectDevice("mic", "mic-2")
    })

    expect(replaceTrack).toHaveBeenCalledWith("mic", "mic-2")
    expect(result.current.selected.mic).toBe("mic-2")
  })
})
