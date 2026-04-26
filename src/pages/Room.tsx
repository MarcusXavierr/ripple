// src/pages/Room.tsx

import type { TFunction } from "i18next"
import { Mic, MicOff, Monitor, PhoneOff, Video, VideoOff } from "lucide-react"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useCallSession } from "@/hooks/useCallSession"
import { usePeerVideoRemoteInput } from "@/hooks/usePeerVideoRemoteInput"
import type { CallStatus } from "@/store/call"

function getStatusLabel(status: CallStatus, t: TFunction): string {
  return {
    idle: t("room.status.idle"),
    connecting: t("room.status.connecting"),
    waiting: t("room.status.waiting"),
    negotiating: t("room.status.negotiating"),
    connected: t("room.status.connected"),
    reconnecting: t("room.status.reconnecting"),
    disconnected: t("room.status.disconnected"),
    ended: t("room.status.ended"),
  }[status]
}

export default function Room() {
  const { id: roomId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const {
    localStream,
    remoteStream,
    status,
    error,
    showReconnectModal,
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

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const { handleRemoteVideoClick } = usePeerVideoRemoteInput({
    remoteVideoRef,
    sendPeerVideoClick,
    sendPeerVideoScroll,
    sendPeerKeyboardInput,
  })

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream
  }, [localStream])

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream
  }, [remoteStream])

  function handleCopyLink() {
    void navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`)
  }

  return (
    <div data-testid="room-page" className="relative h-screen w-screen overflow-hidden bg-black">
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
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              {t("room.controls.copyLink")}
            </Button>
          </div>
        </div>
      )}

      {/* Local video — PiP */}
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        data-testid="local-video"
        className="absolute bottom-20 right-4 h-36 w-48 rounded-lg object-cover shadow-lg"
      />

      {/* Status bar */}
      <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
        <span>{getStatusLabel(status, t)}</span>
        <button
          type="button"
          onClick={handleCopyLink}
          className="font-mono text-white/60 hover:text-white"
        >
          {roomId}
        </button>
      </div>

      {/* Control bar */}
      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleMic}
          aria-label={isMicMuted ? t("room.controls.unmute") : t("room.controls.mute")}
        >
          {isMicMuted ? <MicOff /> : <Mic />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={toggleCamera}
          aria-label={
            isCameraOff ? t("room.controls.enableCamera") : t("room.controls.disableCamera")
          }
        >
          {isCameraOff ? <VideoOff /> : <Video />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
          aria-label={
            isScreenSharing ? t("room.controls.stopSharing") : t("room.controls.shareScreen")
          }
        >
          <Monitor />
        </Button>
        <Button
          variant="destructive"
          size="icon"
          onClick={hangup}
          aria-label={t("room.controls.hangUp")}
        >
          <PhoneOff />
        </Button>
      </div>

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
