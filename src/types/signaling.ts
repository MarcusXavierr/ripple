// SYNC: keep identical to backend types.ts

import type { PeerKeyboardInput, PeerVideoClick, PeerVideoScroll } from "@shared/remoteInputProtocol"

// Server → Client
export type ServerMessage =
  | { type: "onopen"; role: "caller" | "callee"; reconnect: boolean }
  | { type: "enter" }
  | { type: "onclose"; message: string }
  | { type: "peer-reconnected" }
  | { type: "ping" }

// Client → Server (blind relay to other peers)
export type ClientMessage =
  | { type: "offer"; offer: RTCSessionDescriptionInit }
  | { type: "answer"; answer: RTCSessionDescriptionInit }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit }
  | { type: "peer-video-click"; click: PeerVideoClick }
  | { type: "peer-video-scroll"; scroll: PeerVideoScroll }
  | { type: "peer-keyboard-input"; keyboard: PeerKeyboardInput }
  | { type: "pong" }

export const CLOSE_CODES = {
  ROOM_FULL: 4001,
  PEER_DISCONNECTED: 4002,
  ROOM_NOT_FOUND: 4003,
  DUPLICATE_SESSION: 4004,
  PING_TIMEOUT: 4005,
} as const

export const MESSAGE_TYPES = {
  ONOPEN: "onopen",
  ENTER: "enter",
  ONCLOSE: "onclose",
  PEER_RECONNECTED: "peer-reconnected",
  PING: "ping",
  OFFER: "offer",
  ANSWER: "answer",
  ICE_CANDIDATE: "ice-candidate",
  PEER_VIDEO_CLICK: "peer-video-click",
  PEER_VIDEO_SCROLL: "peer-video-scroll",
  PEER_KEYBOARD_INPUT: "peer-keyboard-input",
  PONG: "pong",
} as const

// Messages received from the server (server-emitted + relayed from other peer)
export type ReceivedMessage =
  | ServerMessage
  | { type: "offer"; offer: RTCSessionDescriptionInit }
  | { type: "answer"; answer: RTCSessionDescriptionInit }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit }
  | { type: "peer-video-click"; click: PeerVideoClick }
  | { type: "peer-video-scroll"; scroll: PeerVideoScroll }
  | { type: "peer-keyboard-input"; keyboard: PeerKeyboardInput }
