// SYNC: keep identical to backend types.ts

// Server → Client
export type ServerMessage =
  | { type: "onopen"; role: "caller" | "callee"; reconnect: boolean }
  | { type: "enter" }
  | { type: "onclose"; message: string }
  | { type: "peer-reconnected" }
  | { type: "ping" };

// Client → Server (blind relay to other peers)
export type ClientMessage =
  | { type: "offer"; offer: RTCSessionDescriptionInit }
  | { type: "answer"; answer: RTCSessionDescriptionInit }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit }
  | { type: "pong" };

export type MediaErrorMessage = { type: "error"; code: "ICE_FAILED" | "MEDIA_DENIED" };

export const CLOSE_CODES = {
  ROOM_FULL: 4001,
  PEER_DISCONNECTED: 4002,
  ROOM_NOT_FOUND: 4003,
  DUPLICATE_SESSION: 4004,
  PING_TIMEOUT: 4005,
} as const;

// Messages received from the server (server-emitted + relayed from other peer)
export type ReceivedMessage =
  | ServerMessage
  | { type: 'offer'; offer: RTCSessionDescriptionInit }
  | { type: 'answer'; answer: RTCSessionDescriptionInit }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit }
