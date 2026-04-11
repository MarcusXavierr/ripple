# Architecture — P2P Video Call

## Overview

P2P video call application between two participants. The backend works exclusively as a signaling server — it does not route media. All WebRTC load stays on the frontend.

```
[Peer A] ──── WebSocket ────► [Signaling Server]
[Peer B] ──── WebSocket ────► [Signaling Server]

[Peer A] ◄──────────────────────────────────────► [Peer B]
              WebRTC P2P (video, audio, data channel)
```

---

## Repo Structure

Two separate repos. Types duplicated manually with sync comment.

```
videocall-backend/
├── src/
│   ├── index.ts
│   ├── rooms.ts
│   └── types.ts        ← SYNC: keep identical to frontend
├── package.json
└── tsconfig.json

videocall-frontend/
├── src/
│   ├── main.tsx
│   ├── router.tsx
│   ├── types/
│   │   └── signaling.ts  ← SYNC: keep identical to backend
│   ├── store/
│   │   └── call.ts       ← Zustand
│   ├── hooks/
│   │   └── useWebRTC.ts
│   └── pages/
│       ├── Home.tsx
│       └── Room.tsx
├── package.json
└── tsconfig.json
```

> **On shared types:** no monorepo, no private npm package. The WebSocket contract
> is ~40 lines. Duplicating is honest. A `// SYNC` comment on both files is enough.

---

## Backend — Bun + Elysia

### Responsibilities

- Manage rooms (max 2 peers per room)
- Authenticate reconnection via `peerId`
- Blind relay of WebRTC messages between peers
- Heartbeat to detect ghost peers
- Emit semantic close codes

### In-Memory State

```typescript
// rooms.ts
type PeerEntry = {
  ws: ServerWebSocket<WsData>
  waitingPong: boolean
}

type Room = {
  peers: Map<string, PeerEntry>  // peerId → entry
  caller: string | null           // peerId of caller (immutable once set)
  createdAt: number               // timestamp for GC
}

const rooms = new Map<string, Room>()
```

No Redis for now. State lives in the process. If horizontal scaling is needed in the future, Redis Pub/Sub replaces just `rooms.ts`.

> **Room GC:** run a setInterval every 30 minutes to delete rooms where all peers
> have been disconnected for over 1 hour. Without this, the Map grows forever.

### WebSocket Route

```
wss://<host>/ws?room=<roomId>&peerId=<uuid>
```

#### Entry Logic

```
peerId already exists in room?
  ├── yes → reconnection: update ws, keep role, send { type: 'onopen', reconnect: true, role }
  │          publish { type: 'peer-reconnected' } to other peers in room
  └── no  → new entry:
        room has 2 peers?
          ├── yes → ws.close(4001, 'room full')
          └── no  → assign role (first = 'caller', second = 'callee')
                    send { type: 'onopen', reconnect: false, role }
                    publish { type: 'enter' } to everyone in room
```

#### Relay

The server **does not interpret** WebRTC message content. It just republishes:

```typescript
ws.publish(roomId, rawMessage)
```

Except `pong`, which is consumed internally by the heartbeat.

### Close Codes

```typescript
// types.ts — SYNC with frontend
export const CLOSE_CODES = {
  ROOM_FULL:         4001,
  PEER_DISCONNECTED: 4002,
  ROOM_NOT_FOUND:    4003,
  DUPLICATE_SESSION: 4004,  // same peerId connected from another place
  PING_TIMEOUT:      4005,
} as const
```

### Heartbeat

- Server sends `{ type: 'ping' }` every 15s
- If no `pong` before next cycle → `ws.close(4005)`
- Detects closed tabs without a clean close event (mobile, browser crash)

### Message Diagram

```
            Client A                Server               Client B
                │                      │                      │
  connect ─────►│◄── onopen(caller) ───│                      │
                │                      │◄── connect ──────────│
                │                      │─── onopen(callee) ──►│
                │◄── enter ────────────│                      │
                │                      │                      │
  offer ───────►│──── relay ──────────►│──── offer ──────────►│
                │                      │◄─── answer ──────────│
                │◄── answer ───────────│                      │
                │                      │                      │
  ice-cand ────►│──── relay ──────────►│──── ice-cand ───────►│
                │◄── ice-cand ─────────│◄─── ice-cand ────────│
                │      (trickle, multiple, any order)         │
                │                      │                      │
                │◄═════════════ P2P established ═════════════►│
                │                      │                      │
  F5 ──────────►│                      │                      │
  reconnect ───►│◄── onopen(caller,    │                      │
                │       reconnect=true)│                      │
                │                      │─── peer-reconnected ►│
                │  (caller auto-starts new offer)             │
```

---

## Frontend — Vite + React + Zustand

### Stack

| Lib | Why |
|-----|-----|
| **Vite** | Fast build, zero config |
| **React** | Project requirement |
| **Zustand** | Simple state management, no boilerplate |
| **React Router** | Routing `/` and `/:roomId` |
| **shadcn/ui** | Accessible components, no lock-in |

> **⚠️ simple-peer is dropped.** See bugs section below for why.
> WebRTC is handled directly via native `RTCPeerConnection`.

### Wails 2 Compatibility

The frontend is plain HTML/CSS/JS running on Wails' embedded Chromium. No SSR, no Node.js APIs, nothing that doesn't run in a browser. React + Vite produces a static bundle that Wails serves directly. The only future addition is the `window.go.*` bridge to call Go functions (e.g. `robotgo` for remote control).

### Routing

```
/           → Home (create/join room)
/room/:id   → Room (the actual call)
```

### Global State — Zustand

```typescript
// store/call.ts
type CallStore = {
  // Identity
  peerId: string

  // Connection
  ws: WebSocket | null
  pc: RTCPeerConnection | null
  role: 'caller' | 'callee' | null

  // Media
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  isScreenSharing: boolean

  // UI state
  status: CallStatus
  error: string | null
}

type CallStatus =
  | 'idle'
  | 'connecting'      // WS connecting
  | 'waiting'         // in room, waiting for second peer
  | 'negotiating'     // exchanging offer/answer/candidates
  | 'connected'       // P2P established
  | 'reconnecting'    // attempting ICE restart
  | 'disconnected'    // closed for good
```

### peerId — Cross-Tab Persistence

```typescript
// Survives F5 and tab switch. Expires after 1h to avoid ghost sessions.
function getPeerId(roomId: string): string {
  const key = `peer:${roomId}`
  const stored = localStorage.getItem(key)

  if (stored) {
    const { id, expires } = JSON.parse(stored)
    if (Date.now() < expires) return id
  }

  const id = crypto.randomUUID()
  localStorage.setItem(key, JSON.stringify({
    id,
    expires: Date.now() + 60 * 60 * 1000  // 1h TTL
  }))
  return id
}
```

### Main Hook — useWebRTC

```typescript
// hooks/useWebRTC.ts
// Encapsulates all WS + WebRTC logic.
// The Room component just calls this hook and renders state.

export function useWebRTC(roomId: string) {
  // returns: { localStream, remoteStream, status, error,
  //            startScreenShare, stopScreenShare, hangup }
}
```

### ICE Candidates — Race Condition Fix

```
Problem: remote peer candidates can arrive BEFORE setRemoteDescription.
         addIceCandidate() throws if called without a remote description set.

Solution: manual queue, drained right after setRemoteDescription() resolves.
```

```typescript
const pendingCandidates: RTCIceCandidateInit[] = []
let remoteDescriptionSet = false

async function handleIceCandidate(candidate: RTCIceCandidateInit) {
  if (remoteDescriptionSet) {
    await pc.addIceCandidate(candidate)
  } else {
    pendingCandidates.push(candidate)
  }
}

async function onRemoteDescriptionSet() {
  remoteDescriptionSet = true
  for (const c of pendingCandidates) {
    await pc.addIceCandidate(c)
  }
  pendingCandidates.length = 0
}

// caller: call onRemoteDescriptionSet() after setRemoteDescription(answer)
// callee: call onRemoteDescriptionSet() after setRemoteDescription(offer),
//         before createAnswer
```

### Renegotiation — Perfect Negotiation (RFC 8829)

The naive "only caller can renegotiate" guard has a real bug: if the callee
starts screen share, their `onnegotiationneeded` gets silently suppressed —
screen share never happens on the callee side.

**Correct solution: Perfect Negotiation pattern.**

```typescript
let makingOffer = false
let ignoreOffer = false
const isPolite = role === 'callee'  // callee is the polite peer

pc.onnegotiationneeded = async () => {
  try {
    makingOffer = true
    await pc.setLocalDescription()  // browser auto-creates offer
    send({ type: 'offer', offer: pc.localDescription })
  } finally {
    makingOffer = false
  }
}

// When receiving an offer:
async function handleOffer(offer: RTCSessionDescriptionInit) {
  const offerCollision = makingOffer || pc.signalingState !== 'stable'

  ignoreOffer = !isPolite && offerCollision
  if (ignoreOffer) return  // impolite peer drops the colliding offer

  await pc.setRemoteDescription(offer)
  await onRemoteDescriptionSet()
  await pc.setLocalDescription()  // browser auto-creates answer
  send({ type: 'answer', answer: pc.localDescription })
}
```

Both peers can now renegotiate at any time. The polite peer (callee) always
yields in a collision.

### Screen Share

```typescript
async function startScreenShare() {
  const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
  const screenTrack = screenStream.getVideoTracks()[0]

  const sender = pc.getSenders().find(s => s.track?.kind === 'video')

  if (sender) {
    // replaceTrack does NOT trigger renegotiation — cleanest path
    await sender.replaceTrack(screenTrack)
  } else {
    // No video sender yet — addTrack triggers onnegotiationneeded
    pc.addTrack(screenTrack, screenStream)
  }

  screenTrack.onended = stopScreenShare
}

async function stopScreenShare() {
  const cameraTrack = localStream?.getVideoTracks()[0] ?? null
  const sender = pc.getSenders().find(s => s.track?.kind === 'video')
  if (sender) await sender.replaceTrack(cameraTrack)
  // if cameraTrack is null (user has no camera), sends black frames — expected
}
```

### Reconnection

#### WebSocket reconnect (F5, network drop)

```typescript
let reconnectDelay = 1000
const MAX_DELAY = 30000

function scheduleReconnect() {
  setTimeout(connectWS, reconnectDelay)
  reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY)
}

ws.onclose = (e) => {
  if (e.code === 1000) return  // clean close, user hung up
  scheduleReconnect()
}

ws.onopen = () => { reconnectDelay = 1000 }  // reset on success
```

#### ICE restart (peer connection drops but WS is alive)

```typescript
pc.oniceconnectionstatechange = () => {
  if (pc.iceConnectionState === 'failed') {
    if (role === 'caller') {
      // restartIce() triggers onnegotiationneeded with new ICE credentials
      pc.restartIce()
    }
    // callee waits — caller sends a new offer with iceRestart: true implicitly
  }
}
```

#### What to do with the old RTCPeerConnection on WS reconnect

```typescript
function onWSReconnect() {
  if (pc && pc.connectionState !== 'failed' && pc.connectionState !== 'closed') {
    // PC survived the WS outage — re-initiate signaling only
    if (role === 'caller') pc.restartIce()
  } else {
    // PC is dead — full teardown and recreate
    teardown()
    setupPeerConnection()
  }
}
```

---

## WebSocket Message Protocol

### Types — duplicate in both repos with `// SYNC` comment

```typescript
// Server → Client
type ServerMessage =
  | { type: 'onopen';           role: 'caller' | 'callee'; reconnect: boolean }
  | { type: 'enter' }
  | { type: 'onclose';          message: string }
  | { type: 'peer-reconnected' }
  | { type: 'ping' }

// Client → Server (blind relay to other peers)
type ClientMessage =
  | { type: 'offer';            offer: RTCSessionDescriptionInit }
  | { type: 'answer';           answer: RTCSessionDescriptionInit }
  | { type: 'ice-candidate';    candidate: RTCIceCandidateInit }
  | { type: 'pong' }            // consumed by server, not relayed

// Media error relay (client → server → relay → other client)
type MediaErrorMessage =
  | { type: 'error'; code: 'ICE_FAILED' | 'MEDIA_DENIED' }
```

### Close Codes

| Code | Name | When |
|------|------|------|
| `4001` | `ROOM_FULL` | Room already has 2 peers |
| `4002` | `PEER_DISCONNECTED` | Other peer left |
| `4003` | `ROOM_NOT_FOUND` | Invalid roomId |
| `4004` | `DUPLICATE_SESSION` | Same peerId connected from another place |
| `4005` | `PING_TIMEOUT` | Peer stopped responding to heartbeat |

---

## Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| TURN server | ❌ None | Persona = devs on desktop at home. Mobile CGNAT risk accepted. |
| Topology | Pure P2P | Only 2 people per room. SFU is overkill. |
| Chat | ❌ Out of scope | Data Channel would be the choice if implemented. |
| STUN | `stun.l.google.com:19302` | Free, sufficient for POC. |
| Database | ❌ None | In-memory state. No history. |
| Shared types | Manual duplication | Separate repos. Private npm is overhead for 40 lines. |
| Eden Treaty | ❌ Dropped | Only works with co-located repos. |
| tRPC | ❌ Dropped | Event-driven pub-sub doesn't fit request-response model. |
| simple-peer | ❌ Dropped | See bugs section. |

---

## Frontend State Machine

```
         ┌──────────────────────────────────────────────────────┐
         │                                                      │
  START  │                                                      │
    │    ▼                                                      │
  [IDLE] ──► WS connects ──► [WAITING] ──► peer enters         │
                                  │                             │
                          if caller: create offer               │
                                  │                             │
                           [NEGOTIATING]                        │
                                  │                             │
                      offer/answer/candidates exchanged         │
                                  │                             │
                           [CONNECTED] ◄────────────────────────┘
                                  │                       ICE restart ok
                                  │
                      ICE fails / WS drops
                                  │
                          [RECONNECTING]
                                │     │
                    WS back,    │     │  3 attempts failed
                    PC alive    │     │
                                │     ▼
                                │  [DISCONNECTED]
                                │
                                ▼
                    re-enter negotiation flow
```

---

## Roadmap

```
V1 (now)
  ✓ Trickle ICE
  ✓ ICE candidate race condition fix
  ✓ Hardened reconnection (peerId + localStorage TTL)
  ✓ Screen share via replaceTrack
  ✓ Semantic close codes
  ✓ Heartbeat
  ✓ Perfect Negotiation (RFC 8829)
  ✓ Room GC (memory leak prevention)

V2
  → Chat via RTCDataChannel
  → TURN (coturn on VPS) when mobile support is needed
  → Connection quality indicators (RTCStatsReport)

V3 — Desktop (Wails 2)
  → Static frontend bundle served by Wails
  → Data channel for input events (mouse/keyboard)
  → window.go.* bridge → robotgo to execute input on local machine
  → Normalized coordinates (0-1) in input payload

V4
  → Redis Pub/Sub to scale signaling horizontally
  → N people per room → evaluate SFU (Livekit or mediasoup)
```
