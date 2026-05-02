import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { readDevicePref, writeDevicePref } from "@/lib/call/devicePreferences"
import type { MediaController } from "@/lib/call/MediaController"
import { useCallStore } from "@/store/call"

export type DeviceKind = "mic" | "cam" | "speaker"
export type DeviceInfo = { id: string; label: string }
export type DevicesByKind = { mic: DeviceInfo[]; cam: DeviceInfo[]; speaker: DeviceInfo[] }
export type SelectedDevices = { mic: string; cam: string; speaker: string }

const EMPTY_DEVICES: DevicesByKind = { mic: [], cam: [], speaker: [] }
const EMPTY_SELECTED: SelectedDevices = { mic: "", cam: "", speaker: "" }

function partitionDevices(devices: MediaDeviceInfo[]): DevicesByKind {
  return devices.reduce<DevicesByKind>(
    (result, device) => {
      if (device.kind === "audioinput") {
        result.mic.push({ id: device.deviceId, label: device.label })
      } else if (device.kind === "videoinput") {
        result.cam.push({ id: device.deviceId, label: device.label })
      } else if (device.kind === "audiooutput") {
        result.speaker.push({ id: device.deviceId, label: device.label })
      }
      return result
    },
    { mic: [], cam: [], speaker: [] }
  )
}

function pickExistingDeviceId(
  devices: DeviceInfo[],
  preferredId: string | null | undefined
): string {
  if (preferredId && devices.some((device) => device.id === preferredId)) {
    return preferredId
  }
  return devices[0]?.id ?? ""
}

function getTrackDeviceId(stream: MediaStream | null, kind: "audio" | "video"): string | null {
  const track =
    kind === "audio" ? (stream?.getAudioTracks()[0] ?? null) : (stream?.getVideoTracks()[0] ?? null)
  return track?.getSettings().deviceId ?? null
}

export function useDevices(deps: {
  mediaController: MediaController | null
  localStream: MediaStream | null
}): {
  devices: DevicesByKind
  selected: SelectedDevices
  selectDevice: (kind: DeviceKind, id: string) => Promise<void>
  requestPermission: () => Promise<void>
  speakerSupported: boolean
  permissionGranted: boolean
} {
  const { localStream, mediaController } = deps
  const [devices, setDevices] = useState<DevicesByKind>(EMPTY_DEVICES)
  const [selected, setSelected] = useState<SelectedDevices>(EMPTY_SELECTED)
  const [permissionGranted, setPermissionGranted] = useState(false)
  const inFlightRef = useRef<Promise<void> | null>(null)
  const selectedRef = useRef<SelectedDevices>(EMPTY_SELECTED)

  const speakerSupported = useMemo(() => "setSinkId" in HTMLMediaElement.prototype, [])

  const refreshDevices = useCallback(async () => {
    const enumerated = await navigator.mediaDevices.enumerateDevices()
    const nextDevices = partitionDevices(enumerated)
    setDevices(nextDevices)
    setPermissionGranted(nextDevices.mic.some((device) => device.label !== ""))
    setSelected((current) => {
      const nextSelected = {
        mic: pickExistingDeviceId(
          nextDevices.mic,
          getTrackDeviceId(localStream, "audio") ?? (current.mic || readDevicePref("mic"))
        ),
        cam: pickExistingDeviceId(
          nextDevices.cam,
          getTrackDeviceId(localStream, "video") ?? (current.cam || readDevicePref("cam"))
        ),
        speaker: pickExistingDeviceId(
          nextDevices.speaker,
          current.speaker || readDevicePref("speaker")
        ),
      }
      selectedRef.current = nextSelected
      return nextSelected
    })
    return nextDevices
  }, [localStream])

  const selectDevice = useCallback(
    (kind: DeviceKind, id: string) => {
      if (inFlightRef.current) {
        return inFlightRef.current
      }

      if (kind === "speaker") {
        writeDevicePref("speaker", id)
        setSelected((current) => {
          const next = { ...current, speaker: id }
          selectedRef.current = next
          return next
        })
        return Promise.resolve()
      }

      const run = (async () => {
        try {
          await mediaController?.replaceTrack(kind, id)
          writeDevicePref(kind, id)
          setSelected((current) => {
            const next = { ...current, [kind]: id }
            selectedRef.current = next
            return next
          })

          const isSharing = useCallStore.getState().isScreenSharing
          useCallStore.setState({
            notice: {
              kind: "success",
              messageKey:
                kind === "mic"
                  ? "room.toast.micChanged"
                  : isSharing
                    ? "room.toast.cameraChangedDeferred"
                    : "room.toast.cameraChanged",
            },
          })
        } catch {
          useCallStore.setState({
            notice: { kind: "warning", messageKey: "room.toast.deviceUnpluggedFatal" },
          })
        } finally {
          inFlightRef.current = null
        }
      })()

      inFlightRef.current = run
      return run
    },
    [mediaController]
  )

  const requestPermission = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
    stream.getTracks().forEach((track) => track.stop())
    await refreshDevices()
  }, [refreshDevices])

  useEffect(() => {
    void refreshDevices()
  }, [refreshDevices])

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  useEffect(() => {
    async function handleDeviceChange() {
      const nextDevices = await refreshDevices()
      const currentSelected = selectedRef.current

      for (const kind of ["mic", "cam", "speaker"] as const) {
        const kindDevices = nextDevices[kind]
        const activeId = currentSelected[kind]
        if (!activeId || kindDevices.some((device) => device.id === activeId)) {
          continue
        }

        const fallbackId = kindDevices[0]?.id ?? ""
        if (!fallbackId) {
          setSelected((current) => {
            const next = { ...current, [kind]: "" }
            selectedRef.current = next
            return next
          })
          useCallStore.setState({
            notice: { kind: "warning", messageKey: "room.toast.deviceUnpluggedFatal" },
          })
          continue
        }

        try {
          await selectDevice(kind, fallbackId)
          useCallStore.setState({
            notice: { kind: "warning", messageKey: "room.toast.deviceUnplugged" },
          })
        } catch {
          setSelected((current) => {
            const next = { ...current, [kind]: "" }
            selectedRef.current = next
            return next
          })
          useCallStore.setState({
            notice: { kind: "warning", messageKey: "room.toast.deviceUnpluggedFatal" },
          })
        }
      }
    }

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange)
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange)
    }
  }, [refreshDevices, selectDevice])

  return {
    devices,
    selected,
    selectDevice,
    requestPermission,
    speakerSupported,
    permissionGranted,
  }
}
