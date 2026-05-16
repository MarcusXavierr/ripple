import type { useCallStore } from "@/store/call"
import type { MediaController } from "./MediaController"
import type { PeerConnection } from "./PeerConnection"
import type { SignalingChannel } from "./SignalingChannel"
import {
  type Effect,
  type FullMachineState,
  type MachineEvent,
  type MachineReceivedMessage,
  STATUS_MAP,
  toMachineEvent,
  transition,
} from "./signalingFSM"

export class SignalingMachine {
  private current: FullMachineState = { state: "CONNECTING", role: null }

  private readonly deps: {
    pc: PeerConnection
    ws: SignalingChannel
    media: MediaController
    store: typeof useCallStore
    navigate: (path: string) => void
    onConnected?: () => void
  }

  constructor(deps: {
    pc: PeerConnection
    ws: SignalingChannel
    media: MediaController
    store: typeof useCallStore
    navigate: (path: string) => void
    onConnected?: () => void
  }) {
    this.deps = deps
  }

  handleProtocolMessage(msg: MachineReceivedMessage): Promise<void> {
    try {
      return this.send(toMachineEvent(msg))
    } catch (e) {
      console.error("[FSM]", e)
      return Promise.resolve()
    }
  }

  async send(event: MachineEvent): Promise<void> {
    const prev = this.current
    const { next, effects } = transition(this.current, event)
    this.current = next
    this.deps.store.setState({ status: STATUS_MAP[next.state] })
    if (next.state === "CONNECTED" && prev.state !== "CONNECTED") {
      this.deps.onConnected?.()
    }
    for (const effect of effects) await this.executeEffect(effect)
  }

  private async executeEffect(effect: Effect): Promise<void> {
    switch (effect.type) {
      case "SETUP_PC": {
        this.deps.pc.setup(effect.role)
        const pc = this.deps.pc.raw
        if (!pc) return
        this.deps.store.setState({ pc, role: effect.role })
        this.deps.media.attachPC(pc)
        return
      }
      case "STOP_SCREEN_SHARE":
        if (this.deps.store.getState().isScreenSharing) {
          await this.deps.media.stopScreenShare()
        }
        return
      case "RESET_PC":
        this.deps.pc.close()
        this.deps.store.setState({ remoteStream: null, pc: null })
        return
      case "ROLLBACK_AND_RESTART_ICE":
        await this.deps.pc.rollbackAndRestartIce()
        return
      case "HANDLE_OFFER":
        await this.deps.pc.handleOffer(effect.offer)
        return
      case "HANDLE_ANSWER":
        await this.deps.pc.handleAnswer(effect.answer)
        return
      case "HANDLE_ICE_CANDIDATE":
        await this.deps.pc.handleIceCandidate(effect.candidate)
        return
      case "SEND_WS":
        this.deps.ws.send(effect.msg)
        return
      case "WARN":
        console.warn("[FSM]", effect.message)
        return
      case "SHOW_RECONNECT_MODAL":
        this.deps.store.setState({ showReconnectModal: true })
        return
      case "HIDE_RECONNECT_MODAL":
        this.deps.store.setState({ showReconnectModal: false })
        return
      default: {
        const _: never = effect
        void _
      }
    }
  }
}
