// src/pages/Room.tsx

import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { Controls } from "@/components/room/Controls"
import { SelfTile } from "@/components/room/SelfTile"
import { StatusPill } from "@/components/room/StatusPill"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useCallNotices } from "@/hooks/useCallNotices"
import { useCallSession } from "@/hooks/useCallSession"
import { useDevices } from "@/hooks/useDevices"
import { usePeerVideoRemoteInput } from "@/hooks/usePeerVideoRemoteInput"

function hasHorizontalGutters(video: HTMLVideoElement | null): boolean {
  if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) return false
  const rect = video.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false
  const containScale = Math.min(rect.width / video.videoWidth, rect.height / video.videoHeight)
  const visibleWidth = video.videoWidth * containScale
  return rect.width - visibleWidth > 1
}

export default function Room() {
  const { id: roomId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const {
    localStream,
    remoteStream,
    remoteMediaMode,
    status,
    error,
    showReconnectModal,
    mediaController,
    isScreenSharing,
    isMicMuted,
    isCameraOff,
    startScreenShare,
    stopScreenShare,
    sendPeerVideoClick,
    sendPeerVideoScroll,
    sendPeerKeyboardInput,
    hangup,
    toggleMic,
    toggleCamera,
    dismissError,
    dismissReconnectModal,
  } = useCallSession(roomId!)

  useCallNotices()

  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [showBackdrop, setShowBackdrop] = useState(false)

  const backdropCallbackRef = useCallback(
    (el: HTMLVideoElement | null) => {
      if (el) el.srcObject = remoteStream
    },
    [remoteStream]
  )

  const {
    devices,
    selected,
    selectDevice,
    requestPermission,
    speakerSupported,
    permissionGranted,
  } = useDevices({ mediaController, localStream })
  const { handleRemoteVideoClick } = usePeerVideoRemoteInput({
    remoteVideoRef,
    sendPeerVideoClick,
    sendPeerVideoScroll,
    sendPeerKeyboardInput,
  })

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream
  }, [remoteStream])

  useEffect(() => {
    const updateBackdropVisibility = () => {
      const allowed =
        remoteStream !== null &&
        status !== "waiting" &&
        remoteMediaMode === "camera" &&
        hasHorizontalGutters(remoteVideoRef.current)
      setShowBackdrop(allowed)
    }

    updateBackdropVisibility()
    window.addEventListener("resize", updateBackdropVisibility)
    const video = remoteVideoRef.current
    video?.addEventListener("loadedmetadata", updateBackdropVisibility)

    return () => {
      window.removeEventListener("resize", updateBackdropVisibility)
      video?.removeEventListener("loadedmetadata", updateBackdropVisibility)
    }
  }, [remoteStream, remoteMediaMode, status])

  useEffect(() => {
    const video = remoteVideoRef.current
    if (!speakerSupported || !selected.speaker || !video || !("setSinkId" in video)) return

    void (video as HTMLVideoElement & { setSinkId: (id: string) => Promise<void> })
      .setSinkId(selected.speaker)
      .catch((error) => {
        console.warn("[Room] failed to set speaker output", error)
      })
  }, [selected.speaker, speakerSupported])

  function handleCopyLink() {
    void navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`)
  }

  return (
    <div data-testid="room-page" className="relative h-screen w-screen overflow-hidden bg-black">
      {showBackdrop ? (
        <video
          ref={backdropCallbackRef}
          autoPlay
          playsInline
          muted
          tabIndex={-1}
          data-testid="remote-video-backdrop"
          className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-3xl"
        />
      ) : null}

      {/* Remote video — full viewport */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        data-testid="remote-video"
        className="absolute inset-0 h-full w-full object-contain"
        onClick={handleRemoteVideoClick}
      />

      {/* Waiting overlay */}
      {status === "waiting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
          <p className="text-xl font-medium">{t("room.waiting.message")}</p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-white/70">{roomId}</span>
            <Button
              type="button"
              size="sm"
              onClick={handleCopyLink}
              className="border border-white/25 bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] hover:bg-white/20"
            >
              {t("room.controls.copyLink")}
            </Button>
          </div>
        </div>
      )}

      <StatusPill roomId={roomId!} status={status} hidden={collapsed} />
      <SelfTile stream={localStream} />
      <Controls
        isMicMuted={isMicMuted}
        isCameraOff={isCameraOff}
        isScreenSharing={isScreenSharing}
        toggleMic={toggleMic}
        toggleCamera={toggleCamera}
        startScreenShare={startScreenShare}
        stopScreenShare={stopScreenShare}
        hangup={hangup}
        devices={devices}
        selected={selected}
        onSelectDevice={selectDevice}
        speakerSupported={speakerSupported}
        permissionGranted={permissionGranted}
        onRequestPermission={requestPermission}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
      />

      {/* Error modal */}
      <Dialog
        open={error !== null}
        onOpenChange={(open) => {
          if (!open) dismissError()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("room.error.title")}</DialogTitle>
            <DialogDescription>{error}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={dismissError}>{t("room.error.ok")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Peer disconnected modal */}
      <Dialog
        open={showReconnectModal}
        onOpenChange={(open) => {
          if (!open) dismissReconnectModal()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("room.reconnect.title")}</DialogTitle>
            <DialogDescription>{t("room.reconnect.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={dismissReconnectModal}>
              {t("room.reconnect.stay")}
            </Button>
            <Button onClick={() => navigate("/")}>{t("room.reconnect.goHome")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
