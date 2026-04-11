# PRD: Ripple — P2P Video Call Frontend

## Product Summary

Ripple is a browser-based 1-on-1 video call application. Two participants connect directly via WebRTC — the server only handles signaling. No accounts, no history, no database. Open a link, join a room, talk.

## Target User

Developers on desktop machines with stable home connections. No mobile optimization required for V1. TURN server omitted — symmetric NAT failures are an accepted risk.

## Core User Flows

### Flow 1 — Create a room and invite someone

1. User opens `/` (Home)
2. Clicks "Create Room"
3. App generates a readable slug (e.g. `coral-tiger-42`), redirects to `/room/coral-tiger-42`
4. Browser prompts for camera/mic permission
5. User sees their own video full-screen with "Waiting for someone to join..." overlay
6. Room link is displayed with a copy button
7. User shares the link

### Flow 2 — Join an existing room

1. User opens `/` and pastes a room ID or full URL into the input field, clicks "Join"
   — OR clicks a shared link directly, landing on `/room/:id`
2. Browser prompts for camera/mic permission
3. WebSocket connects, signaling negotiates, P2P establishes
4. Remote video fills the screen, local video appears as a PiP thumbnail in the corner

## Call Screen

### Layout

- Remote peer's video fills the viewport
- Local video is a small thumbnail in the bottom-right corner (PiP style)
- Bottom bar with four controls: toggle mic, toggle camera, screen share, hang up
- Subtle status indicator showing connection state (connecting, connected, reconnecting) and room ID with copy action

### Control Bar Behavior

- **Mic toggle**: mutes/unmutes local audio track. Visual indicator when muted.
- **Camera toggle**: enables/disables local video track. When off, remote peer sees a black frame.
- **Screen share**: replaces camera feed via `replaceTrack()`. Button toggles between "Share Screen" and "Stop Sharing". When the user stops sharing (or closes the browser share picker), camera feed resumes automatically.
- **Hang up**: navigates to the "Call ended" screen.

### Status Indicator

- Shows current `CallStatus` in human-readable form: "Connecting...", "Waiting for peer...", "Connected", "Reconnecting..."
- Room ID displayed as small text, clickable to copy the full room URL

## Call Ended Screen

Reached after clicking "Hang up" or when the other peer disconnects permanently.

- "Call ended" message
- "Rejoin" button — navigates back to `/room/:id` (same room)
- "Return home" button — navigates to `/`

## Error Handling

All errors surface as modal dialogs. The user must acknowledge before proceeding.

| Trigger | Modal Message | Action on Dismiss |
|---------|--------------|-------------------|
| Room full (4001) | "This room is full. Only two participants are allowed." | Redirect to Home |
| Peer disconnected (4002) | "The other participant left the call." | Navigate to Call Ended screen |
| Room not found (4003) | "This room doesn't exist." | Redirect to Home |
| Duplicate session (4004) | "You're connected to this room from another tab." | Redirect to Home |
| Ping timeout (4005) | Silent — triggers reconnection flow. Modal only after 3 failed attempts: "Connection lost. Unable to reconnect." | Navigate to Call Ended screen |
| Media permission denied | "Camera and microphone access is required to join a call." | Stay on current page, let user retry via browser settings |
| WebSocket connection failed | Silent retries with exponential backoff. Modal after 3 failures: "Unable to connect to the server." | Redirect to Home |

## Reconnection (User-Visible Behavior)

The user should not need to understand what's happening under the hood. From their perspective:

- **Brief network drop**: status indicator shows "Reconnecting..." — if recovery succeeds within a few seconds, the call resumes. No modal, no interruption.
- **Peer refreshes the page (F5)**: same as above — "Reconnecting..." then back to "Connected". The `peerId` in localStorage ensures the server recognizes the returning peer.
- **Unrecoverable failure** (3 WS retries exhausted or ICE restart fails): modal appears, then Call Ended screen.

## Pages Summary

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Home | Create room (generates slug, copies link) or join room (paste ID/URL) |
| `/room/:id` | Room | The call — video, controls, status. Handles waiting, negotiation, connected states |
| `/room/:id/ended` | Call Ended | "Call ended" with Rejoin and Return Home buttons |

## Tech Stack

| Library | Purpose |
|---------|---------|
| Vite | Build tooling |
| React | UI |
| React Router | Routing between Home, Room, Call Ended |
| Zustand | Global state — connection status, streams, role, errors |
| Tailwind CSS | Utility-first styling |
| shadcn/ui | UI components — buttons, modals, inputs |
| Native RTCPeerConnection | WebRTC — no wrapper library |

## Room ID Format

Human-readable slugs generated client-side. Format: `{adjective}-{noun}-{number}`, e.g. `coral-tiger-42`. Collision risk is acceptable — the room only lives in server memory for the duration of a session.

## Out of Scope for V1

- Mobile / responsive layout
- Chat (text messaging via data channel)
- TURN server support
- Connection quality indicators
- Dark/light theme toggle
- User accounts or authentication
- Call history or recording
- Multiple participants (>2)
- Wails desktop integration
