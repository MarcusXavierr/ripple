import type { CallStatus } from "@/store/call"
import type { ClientMessage, ReceivedMessage } from "@/types/signaling"

export type MachineReceivedMessage = ReceivedMessage

export type MachineState =
  | "IDLE"
  | "CONNECTING"
  | "CALLER_WAITING"
  | "CALLEE_WAITING"
  | "CALLER_ORPHANED"
  | "CALLEE_ORPHANED"
  | "NEGOTIATING"
  | "CONNECTED"

export const STATUS_MAP: Record<MachineState, CallStatus> = {
  IDLE: "idle",
  CONNECTING: "connecting",
  CALLER_WAITING: "waiting",
  CALLEE_WAITING: "waiting",
  CALLER_ORPHANED: "waiting",
  CALLEE_ORPHANED: "waiting",
  NEGOTIATING: "negotiating",
  CONNECTED: "connected",
}

export type FullMachineState = {
  state: MachineState
  role: "caller" | "callee" | null
}

export type MachineEvent =
  | { type: "onopen"; role: "caller" | "callee"; reconnect: boolean }
  | { type: "enter" }
  | { type: "peer-reconnected" }
  | { type: "onclose"; message: string }
  | { type: "ping" }
  | { type: "offer"; offer: RTCSessionDescriptionInit }
  | { type: "answer"; answer: RTCSessionDescriptionInit }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit }
  | { type: "ice-connected" }
  | { type: "ice-failed" }

export type Effect =
  | { type: "SETUP_PC"; role: "caller" | "callee" }
  | { type: "RESET_PC" }
  | { type: "ROLLBACK_AND_RESTART_ICE" }
  | { type: "HANDLE_OFFER"; offer: RTCSessionDescriptionInit }
  | { type: "HANDLE_ANSWER"; answer: RTCSessionDescriptionInit }
  | { type: "HANDLE_ICE_CANDIDATE"; candidate: RTCIceCandidateInit }
  | { type: "SEND_WS"; msg: ClientMessage }
  | { type: "WARN"; message: string }
  | { type: "SHOW_RECONNECT_MODAL" }
  | { type: "HIDE_RECONNECT_MODAL" }

function handleOnopen(
  full: FullMachineState,
  event: { type: "onopen"; role: "caller" | "callee"; reconnect: boolean }
): { next: FullMachineState; effects: Effect[] } {
  const role = full.role !== null ? full.role : event.role
  return {
    next: { state: role === "caller" ? "CALLER_WAITING" : "CALLEE_WAITING", role },
    effects: [{ type: "SETUP_PC", role }],
  }
}

function handleEnter(full: FullMachineState): { next: FullMachineState; effects: Effect[] } {
  if (full.state === "CALLER_WAITING") {
    return {
      next: { ...full, state: "NEGOTIATING" },
      effects: [{ type: "SETUP_PC", role: "caller" }],
    }
  }
  return {
    next: full,
    effects: [{ type: "WARN", message: `unhandled event: enter in ${full.state}` }],
  }
}

function handlePeerReconnected(full: FullMachineState): {
  next: FullMachineState
  effects: Effect[]
} {
  if (full.role === "caller" && full.state === "CALLER_ORPHANED") {
    return {
      next: { ...full, state: "CALLER_WAITING" },
      effects: [{ type: "SETUP_PC", role: "caller" }, { type: "HIDE_RECONNECT_MODAL" }],
    }
  }
  if (full.role === "callee" && full.state === "CALLEE_ORPHANED") {
    return {
      next: { ...full, state: "CALLEE_WAITING" },
      effects: [{ type: "SETUP_PC", role: "callee" }, { type: "HIDE_RECONNECT_MODAL" }],
    }
  }
  if (full.role === "caller" && (full.state === "NEGOTIATING" || full.state === "CONNECTED")) {
    return {
      next: { ...full, state: "NEGOTIATING" },
      effects: [{ type: "ROLLBACK_AND_RESTART_ICE" }, { type: "HIDE_RECONNECT_MODAL" }],
    }
  }
  if (full.role === "callee" && (full.state === "NEGOTIATING" || full.state === "CONNECTED")) {
    return {
      next: { ...full, state: "CALLEE_WAITING" },
      effects: [
        { type: "RESET_PC" },
        { type: "SETUP_PC", role: "callee" },
        { type: "HIDE_RECONNECT_MODAL" },
      ],
    }
  }
  return {
    next: full,
    effects: [{ type: "WARN", message: `unhandled event: peer-reconnected in ${full.state}` }],
  }
}

function handleOnclose(full: FullMachineState): { next: FullMachineState; effects: Effect[] } {
  if (full.state === "CONNECTED") {
    if (full.role === "caller") {
      return {
        next: { ...full, state: "CALLER_ORPHANED" },
        effects: [{ type: "RESET_PC" }, { type: "SHOW_RECONNECT_MODAL" }],
      }
    } else if (full.role === "callee") {
      return {
        next: { ...full, state: "CALLEE_ORPHANED" },
        effects: [{ type: "RESET_PC" }, { type: "SHOW_RECONNECT_MODAL" }],
      }
    }
  }
  if (full.state === "NEGOTIATING") {
    if (full.role === "caller") {
      return { next: { ...full, state: "CALLER_ORPHANED" }, effects: [{ type: "RESET_PC" }] }
    } else if (full.role === "callee") {
      return { next: { ...full, state: "CALLEE_ORPHANED" }, effects: [{ type: "RESET_PC" }] }
    }
  }
  return {
    next: full,
    effects: [{ type: "WARN", message: `unhandled event: onclose in ${full.state}` }],
  }
}

function handleOffer(
  full: FullMachineState,
  event: { type: "offer"; offer: RTCSessionDescriptionInit }
): { next: FullMachineState; effects: Effect[] } {
  if (full.state === "CALLEE_WAITING") {
    return {
      next: { ...full, state: "NEGOTIATING" },
      effects: [{ type: "HANDLE_OFFER", offer: event.offer }],
    }
  } else if (full.state === "NEGOTIATING" || full.state === "CONNECTED") {
    return { next: full, effects: [{ type: "HANDLE_OFFER", offer: event.offer }] }
  }
  return {
    next: full,
    effects: [{ type: "WARN", message: `unhandled event: offer in ${full.state}` }],
  }
}

function handleAnswer(
  full: FullMachineState,
  event: { type: "answer"; answer: RTCSessionDescriptionInit }
): { next: FullMachineState; effects: Effect[] } {
  if (full.state === "NEGOTIATING" || full.state === "CONNECTED") {
    return { next: full, effects: [{ type: "HANDLE_ANSWER", answer: event.answer }] }
  }
  if (full.state === "CALLER_WAITING") {
    return {
      next: { ...full, state: "NEGOTIATING" },
      effects: [{ type: "HANDLE_ANSWER", answer: event.answer }],
    }
  }
  return {
    next: full,
    effects: [{ type: "WARN", message: `unhandled event: answer in ${full.state}` }],
  }
}

function handleIceCandidate(
  full: FullMachineState,
  event: { type: "ice-candidate"; candidate: RTCIceCandidateInit }
): { next: FullMachineState; effects: Effect[] } {
  if (full.state === "NEGOTIATING" || full.state === "CONNECTED") {
    return { next: full, effects: [{ type: "HANDLE_ICE_CANDIDATE", candidate: event.candidate }] }
  }
  return {
    next: full,
    effects: [{ type: "WARN", message: `unhandled event: ice-candidate in ${full.state}` }],
  }
}

function handleIceConnected(full: FullMachineState): { next: FullMachineState; effects: Effect[] } {
  if (full.state === "NEGOTIATING") {
    return { next: { ...full, state: "CONNECTED" }, effects: [] }
  }
  return {
    next: full,
    effects: [{ type: "WARN", message: `unhandled event: ice-connected in ${full.state}` }],
  }
}

function handleIceFailed(full: FullMachineState): { next: FullMachineState; effects: Effect[] } {
  if (full.state === "NEGOTIATING" || full.state === "CONNECTED") {
    if (full.role === "caller") {
      return {
        next: { ...full, state: "NEGOTIATING" },
        effects: [{ type: "ROLLBACK_AND_RESTART_ICE" }],
      }
    } else {
      return {
        next: full,
        effects: [{ type: "WARN", message: `unhandled event: ice-failed in ${full.state}` }],
      }
    }
  }
  return {
    next: full,
    effects: [{ type: "WARN", message: `unhandled event: ice-failed in ${full.state}` }],
  }
}

export function transition(
  full: FullMachineState,
  event: MachineEvent
): { next: FullMachineState; effects: Effect[] } {
  switch (event.type) {
    case "onopen":
      return handleOnopen(full, event)
    case "enter":
      return handleEnter(full)
    case "peer-reconnected":
      return handlePeerReconnected(full)
    case "onclose":
      return handleOnclose(full)
    case "ping":
      return { next: full, effects: [{ type: "SEND_WS", msg: { type: "pong" } }] }
    case "offer":
      return handleOffer(full, event)
    case "answer":
      return handleAnswer(full, event)
    case "ice-candidate":
      return handleIceCandidate(full, event)
    case "ice-connected":
      return handleIceConnected(full)
    case "ice-failed":
      return handleIceFailed(full)
    default: {
      const _: never = event
      void _
      return {
        next: full,
        effects: [
          {
            type: "WARN",
            message: `unhandled event: ${(event as MachineEvent).type} in ${full.state}`,
          },
        ],
      }
    }
  }
}

export function toMachineEvent(msg: MachineReceivedMessage): MachineEvent {
  switch (msg.type) {
    case "onopen":
      return { type: "onopen", role: msg.role, reconnect: msg.reconnect }
    case "enter":
      return { type: "enter" }
    case "peer-reconnected":
      return { type: "peer-reconnected" }
    case "onclose":
      return { type: "onclose", message: msg.message }
    case "ping":
      return { type: "ping" }
    case "offer":
      return { type: "offer", offer: msg.offer }
    case "answer":
      return { type: "answer", answer: msg.answer }
    case "ice-candidate":
      return { type: "ice-candidate", candidate: msg.candidate }
    default: {
      const _: never = msg
      void _
      throw new Error(`[FSM] unknown protocol message: ${(msg as { type: string }).type}`)
    }
  }
}
