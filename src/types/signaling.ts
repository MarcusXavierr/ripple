// SYNC: keep identical to backend types.ts

// Server → Client
export type ServerMessage =
  | { type: "onopen"; role: "caller" | "callee"; reconnect: boolean }
// TODO: [Types] Porra, esse enter é o de quando o oponente entra na sala né. não deveria ter um nome melhor?
  | { type: "enter" }
// TODO: [Types] Esse onclose é mandado quando o oponente sai da sala ou quando nós saímos da sala? o oponente né
  | { type: "onclose"; message: string }
  | { type: "peer-reconnected" }
  | { type: "ping" };

// Client → Server (blind relay to other peers)
export type ClientMessage =
  | { type: "offer"; offer: RTCSessionDescriptionInit }
  | { type: "answer"; answer: RTCSessionDescriptionInit }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit }
  | { type: "pong" };

export const CLOSE_CODES = {
  ROOM_FULL: 4001,
  PEER_DISCONNECTED: 4002,
  ROOM_NOT_FOUND: 4003,
  DUPLICATE_SESSION: 4004,
  PING_TIMEOUT: 4005,
} as const;

export const MESSAGE_TYPES = {
  ONOPEN: 'onopen',
  ENTER: 'enter',
  ONCLOSE: 'onclose',
  PEER_RECONNECTED: 'peer-reconnected',
  PING: 'ping',
  OFFER: 'offer',
  ANSWER: 'answer',
  ICE_CANDIDATE: 'ice-candidate',
  PONG: 'pong',
} as const;

// Messages received from the server (server-emitted + relayed from other peer)
// TODO: [Types] usai, essa porra tá duplicada?
export type ReceivedMessage =
  | ServerMessage
  | { type: 'offer'; offer: RTCSessionDescriptionInit }
  | { type: 'answer'; answer: RTCSessionDescriptionInit }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit }
