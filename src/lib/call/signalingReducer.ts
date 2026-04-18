import type { ReceivedMessage, ClientMessage } from "@/types/signaling";
import type { CallStatus } from "@/store/call";

export interface SignalingState {
  role: "caller" | "callee" | null;
  makingOffer: boolean;
  signalingState: RTCSignalingState | null;
}

export type SignalingAction =
  | { type: "SET_STATUS"; status: CallStatus }
  | { type: "SETUP_PC"; role: "caller" | "callee" }
  | { type: "RESTART_ICE" }
  | { type: "ROLLBACK_AND_RESTART_ICE" }
  | { type: "SEND_WS"; msg: ClientMessage }
  | { type: "HANDLE_OFFER"; offer: RTCSessionDescriptionInit }
  | { type: "HANDLE_ANSWER"; answer: RTCSessionDescriptionInit }
  | { type: "HANDLE_ICE_CANDIDATE"; candidate: RTCIceCandidateInit }
  | { type: "WARN"; message: string };

export function reduce(state: SignalingState, msg: ReceivedMessage): SignalingAction[] {
  if (msg.type === "onopen") {
    return [
      { type: "SETUP_PC", role: msg.role },
      { type: "SET_STATUS", status: "waiting" },
    ];
  }

  if (msg.type === "ping") {
    return [{ type: "SEND_WS", msg: { type: "pong" } }];
  }

  if (msg.type === "enter") {
    if (state.role !== "caller") {
      return [{ type: "WARN", message: "enter received but role is not caller" }];
    }
    if (state.signalingState !== "stable") {
      return [{ type: "SET_STATUS", status: "negotiating" }, { type: "ROLLBACK_AND_RESTART_ICE" }];
    }
    return [{ type: "SET_STATUS", status: "negotiating" }, { type: "RESTART_ICE" }];
  }

  if (msg.type === "peer-reconnected") {
    if (state.role !== "caller") {
      return [{ type: "WARN", message: "peer-reconnected received but role is not caller" }];
    }
    return [{ type: "SET_STATUS", status: "negotiating" }, { type: "RESTART_ICE" }];
  }

  if (msg.type === "offer") {
    const isCollision = state.makingOffer || state.signalingState !== "stable";
    if (state.role !== "callee" && isCollision) {
      return [{ type: "WARN", message: "offer collision ignored (not the polite peer)" }];
    }
    return [{ type: "HANDLE_OFFER", offer: msg.offer }];
  }

  if (msg.type === "answer") {
    if (state.role !== "caller") {
      return [{ type: "WARN", message: "answer received but role is not caller" }];
    }
    return [{ type: "HANDLE_ANSWER", answer: msg.answer }];
  }

  if (msg.type === "ice-candidate") {
    return [{ type: "HANDLE_ICE_CANDIDATE", candidate: msg.candidate }];
  }

  return [{ type: "WARN", message: `unknown message type: ${(msg as { type: string }).type}` }];
}
