import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CallSession } from "@/lib/call/CallSession";
import { useCallStore } from "@/store/call";

export function useCallSession(roomId: string) {
  const navigate = useNavigate();
  const sessionRef = useRef<CallSession | null>(null);

  useEffect(() => {
    const session = new CallSession(roomId, navigate);
    sessionRef.current = session;
    session.start();
    return () => {
      session.teardown();
    };
  }, [roomId, navigate]);

  const localStream = useCallStore((s) => s.localStream);
  const remoteStream = useCallStore((s) => s.remoteStream);
  const status = useCallStore((s) => s.status);
  const error = useCallStore((s) => s.error);
  const isMicMuted = useCallStore((s) => s.isMicMuted);
  const isCameraOff = useCallStore((s) => s.isCameraOff);
  const isScreenSharing = useCallStore((s) => s.isScreenSharing);

  const dismissError = useCallback(() => {
    const err = useCallStore.getState().error;
    useCallStore.setState({ error: null });
    if (
      err?.includes("room is full") ||
      err?.includes("doesn't exist") ||
      err?.includes("another tab") ||
      err?.includes("Unable to connect")
    ) {
      navigate("/");
    }
  }, [navigate]);

  return {
    localStream,
    remoteStream,
    status,
    error,
    isMicMuted,
    isCameraOff,
    isScreenSharing,
    toggleMic: () => sessionRef.current?.media.toggleMic(),
    toggleCamera: () => sessionRef.current?.media.toggleCamera(),
    startScreenShare: () => sessionRef.current?.media.startScreenShare(),
    stopScreenShare: () => sessionRef.current?.media.stopScreenShare(),
    hangup: () => sessionRef.current?.hangup(),
    dismissError,
  };
}
