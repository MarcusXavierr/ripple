// Implementation in a later task
export function useWebRTC(_roomId: string) {
  return {
    localStream: null as MediaStream | null,
    remoteStream: null as MediaStream | null,
    status: "idle" as const,
    error: null as string | null,
    startScreenShare: async () => {},
    stopScreenShare: async () => {},
    hangup: () => {},
  };
}
