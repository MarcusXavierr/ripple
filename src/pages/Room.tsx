// src/pages/Room.tsx
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Mic, MicOff, Monitor, PhoneOff, Video, VideoOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCallSession } from '@/hooks/useCallSession'
import type { CallStatus } from '@/store/call'

const STATUS_LABEL: Record<CallStatus, string> = {
  idle: 'Connecting...',
  connecting: 'Connecting...',
  waiting: 'Waiting for peer...',
  negotiating: 'Connecting...',
  connected: 'Connected',
  reconnecting: 'Reconnecting...',
  disconnected: 'Disconnected',
}

export default function Room() {
  const { id: roomId } = useParams<{ id: string }>()
  const {
    localStream,
    remoteStream,
    status,
    error,
    isScreenSharing,
    isMicMuted,
    isCameraOff,
    startScreenShare,
    stopScreenShare,
    hangup,
    toggleMic,
    toggleCamera,
    dismissError,
  } = useCallSession(roomId!)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

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
      />

      {/* Waiting overlay */}
      {status === 'waiting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
          <p className="text-xl font-medium">Waiting for someone to join...</p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-white/70">{roomId}</span>
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              Copy link
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
        <span>{STATUS_LABEL[status]}</span>
        <button type="button" onClick={handleCopyLink} className="font-mono text-white/60 hover:text-white">
          {roomId}
        </button>
      </div>

      {/* Control bar */}
      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleMic}
          aria-label={isMicMuted ? 'Unmute' : 'Mute'}
        >
          {isMicMuted ? <MicOff /> : <Mic />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={toggleCamera}
          aria-label={isCameraOff ? 'Enable camera' : 'Disable camera'}
        >
          {isCameraOff ? <VideoOff /> : <Video />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
          aria-label={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        >
          <Monitor />
        </Button>
        <Button variant="destructive" size="icon" onClick={hangup} aria-label="Hang up">
          <PhoneOff />
        </Button>
      </div>

      {/* Error modal */}
      <Dialog open={error !== null} onOpenChange={(open) => { if (!open) dismissError() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
            <DialogDescription>{error}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={dismissError}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
