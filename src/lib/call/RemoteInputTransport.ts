import { isRemoteInputMessage, type RemoteInputMessage } from "@shared/remoteInputProtocol"
import type { DataChannelSpec } from "./PeerConnection"

type ChannelLabel = "input" | "scroll"

interface DataChannelSender {
  sendOnChannel(label: string, data: string): boolean
}

const CHANNEL_FOR_TYPE: Record<RemoteInputMessage["type"], ChannelLabel> = {
  "remote-click": "input",
  "remote-keyboard": "input",
  "remote-scroll": "scroll",
}

export class RemoteInputTransport {
  static readonly CHANNEL_SPECS: DataChannelSpec[] = [
    { label: "input", init: { ordered: true } },
    { label: "scroll", init: { ordered: true, maxRetransmits: 0 } },
  ]

  private readonly pc: DataChannelSender
  private handler: (msg: RemoteInputMessage) => void = () => {}

  constructor(pc: DataChannelSender) {
    this.pc = pc
  }

  send(msg: RemoteInputMessage): boolean {
    const label = CHANNEL_FOR_TYPE[msg.type]
    return this.pc.sendOnChannel(label, JSON.stringify(msg))
  }

  handleChannelMessage(label: string, data: string): void {
    if (label !== "input" && label !== "scroll") {
      console.warn(`[RemoteInputTransport] message on unknown channel ${label}`)
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(data)
    } catch {
      console.warn("[RemoteInputTransport] invalid JSON")
      return
    }
    if (!isRemoteInputMessage(parsed)) {
      console.warn("[RemoteInputTransport] invalid schema")
      return
    }
    if (CHANNEL_FOR_TYPE[parsed.type] !== label) {
      console.warn(`[RemoteInputTransport] type ${parsed.type} arrived on wrong channel ${label}`)
      return
    }
    this.handler(parsed)
  }

  onMessage(handler: (msg: RemoteInputMessage) => void): void {
    this.handler = handler
  }
}
