# WebRTC Signaling FSM Transitions

This document outlines the state transitions and side effects handled by the pure Asymmetric Finite State Machine (`src/lib/call/signalingFSM.ts`).

## States
- `IDLE`: Initial state before anything begins.
- `CONNECTING`: WebSocket connection is being established.
- `CALLER_WAITING`: User is the caller and is waiting for the callee to join.
- `CALLEE_WAITING`: User is the callee and is waiting for an offer from the caller.
- `NEGOTIATING`: Active WebRTC negotiation (SDP offer/answer exchange and ICE candidates).
- `CONNECTED`: ICE connection is successfully established.

## Transitions Matrix

| Event | Valid States | Next State | Effects | Notes |
|-------|-------------|------------|---------|-------|
| `onopen` | Any state | `CALLER_WAITING` / `CALLEE_WAITING` | `SETUP_PC` | Assigns immutable role based on server response. |
| `enter` | `CALLER_WAITING` | `NEGOTIATING` | `ROLLBACK_AND_RESTART_ICE` | Caller initiates negotiation. Unhandled for callee. |
| `peer-reconnected` | `NEGOTIATING`, `CONNECTED` | `NEGOTIATING` (if caller) | `ROLLBACK_AND_RESTART_ICE` | Caller restarts negotiation. Callee waits passively. |
| `onclose` | `NEGOTIATING`, `CONNECTED` | `CALLER_WAITING` / `CALLEE_WAITING` | `RESET_PC` | Fixes the "F5 bug" (tears down PC). |
| `ping` | Any state | *(Unchanged)* | `SEND_WS(pong)` | Heartbeat from server. |
| `offer` | `CALLEE_WAITING`, `NEGOTIATING`, `CONNECTED` | `NEGOTIATING` (if from `CALLEE_WAITING`) | `HANDLE_OFFER` | Callee processes initially. Perfect negotiation handles collisions. |
| `answer` | `NEGOTIATING`, `CONNECTED` | *(Unchanged)* | `HANDLE_ANSWER` | Processes the SDP answer. |
| `ice-candidate` | `NEGOTIATING`, `CONNECTED` | *(Unchanged)* | `HANDLE_ICE_CANDIDATE` | Adds remote candidate to PC. |
| `ice-connected` | `NEGOTIATING` | `CONNECTED` | *(None)* | PC ICE state becomes connected/completed. |
| `ice-failed` | `NEGOTIATING`, `CONNECTED` | `NEGOTIATING` (if caller) | `ROLLBACK_AND_RESTART_ICE` | Caller attempts ICE restart aggressively. |

## Fallthrough / Unhandled Events
If an event is received in a state where it is not explicitly handled by the logic above, the machine does **not** change state and emits a `WARN` effect. This enforces strict behavioral boundaries and makes it easy to spot out-of-order signaling messages.
