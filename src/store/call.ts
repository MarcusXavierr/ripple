import { create } from "zustand";

export type CallStatus =
  | "idle"
  | "connecting"
  | "waiting"
  | "negotiating"
  | "connected"
  | "reconnecting"
  | "disconnected";

type CallStore = {
  peerId: string;
  ws: WebSocket | null;
  pc: RTCPeerConnection | null;
  role: "caller" | "callee" | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isScreenSharing: boolean;
  status: CallStatus;
  error: string | null;
};

export const useCallStore = create<CallStore>()(() => ({
  peerId: "",
  ws: null,
  pc: null,
  role: null,
  localStream: null,
  remoteStream: null,
  isScreenSharing: false,
  status: "idle",
  error: null,
}));
