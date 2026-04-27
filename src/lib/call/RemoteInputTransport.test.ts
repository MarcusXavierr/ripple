import { describe, expect, it, vi } from "vitest"
import { samplePeerKeyboardInput } from "@/testing/peerKeyboardInput.fixture"
import { samplePeerVideoClick } from "@/testing/peerVideoClick.fixture"
import { samplePeerVideoScroll } from "@/testing/peerVideoScroll.fixture"
import { RemoteInputTransport } from "./RemoteInputTransport"

function makePcStub() {
  return { sendOnChannel: vi.fn().mockReturnValue(true) }
}

describe("RemoteInputTransport.CHANNEL_SPECS", () => {
  it("declares input as ordered+reliable and scroll as ordered+lossy", () => {
    const byLabel = Object.fromEntries(
      RemoteInputTransport.CHANNEL_SPECS.map((s) => [s.label, s.init])
    )
    expect(byLabel.input).toEqual({ ordered: true })
    expect(byLabel.scroll).toEqual({ ordered: true, maxRetransmits: 0 })
  })
})

describe("RemoteInputTransport.send", () => {
  it("routes remote-click to the input channel", () => {
    const pc = makePcStub()
    const t = new RemoteInputTransport(pc)
    const click = samplePeerVideoClick
    expect(t.send({ type: "remote-click", click })).toBe(true)
    expect(pc.sendOnChannel).toHaveBeenCalledWith(
      "input",
      JSON.stringify({ type: "remote-click", click })
    )
  })

  it("routes remote-keyboard to the input channel", () => {
    const pc = makePcStub()
    const t = new RemoteInputTransport(pc)
    const keyboard = samplePeerKeyboardInput
    t.send({ type: "remote-keyboard", keyboard })
    expect(pc.sendOnChannel).toHaveBeenCalledWith(
      "input",
      JSON.stringify({ type: "remote-keyboard", keyboard })
    )
  })

  it("routes remote-scroll to the scroll channel", () => {
    const pc = makePcStub()
    const t = new RemoteInputTransport(pc)
    const scroll = samplePeerVideoScroll
    t.send({ type: "remote-scroll", scroll })
    expect(pc.sendOnChannel).toHaveBeenCalledWith(
      "scroll",
      JSON.stringify({ type: "remote-scroll", scroll })
    )
  })

  it("returns whatever the underlying sendOnChannel returns", () => {
    const pc = { sendOnChannel: vi.fn().mockReturnValue(false) }
    const t = new RemoteInputTransport(pc)
    expect(t.send({ type: "remote-click", click: samplePeerVideoClick })).toBe(false)
  })
})

describe("RemoteInputTransport.handleChannelMessage", () => {
  it("dispatches a valid remote-click received on input", () => {
    const pc = makePcStub()
    const t = new RemoteInputTransport(pc)
    const handler = vi.fn()
    t.onMessage(handler)

    const click = samplePeerVideoClick
    t.handleChannelMessage("input", JSON.stringify({ type: "remote-click", click }))
    expect(handler).toHaveBeenCalledWith({ type: "remote-click", click })
  })

  it("dispatches a valid remote-scroll received on scroll", () => {
    const pc = makePcStub()
    const t = new RemoteInputTransport(pc)
    const handler = vi.fn()
    t.onMessage(handler)

    const scroll = samplePeerVideoScroll
    t.handleChannelMessage("scroll", JSON.stringify({ type: "remote-scroll", scroll }))
    expect(handler).toHaveBeenCalledWith({ type: "remote-scroll", scroll })
  })

  it("drops a message arriving on the wrong channel", () => {
    const pc = makePcStub()
    const t = new RemoteInputTransport(pc)
    const handler = vi.fn()
    t.onMessage(handler)

    t.handleChannelMessage(
      "scroll",
      JSON.stringify({ type: "remote-click", click: samplePeerVideoClick })
    )
    t.handleChannelMessage(
      "input",
      JSON.stringify({ type: "remote-scroll", scroll: samplePeerVideoScroll })
    )
    expect(handler).not.toHaveBeenCalled()
  })

  it("drops messages on unknown labels", () => {
    const pc = makePcStub()
    const t = new RemoteInputTransport(pc)
    const handler = vi.fn()
    t.onMessage(handler)
    t.handleChannelMessage(
      "garbage",
      JSON.stringify({ type: "remote-click", click: samplePeerVideoClick })
    )
    expect(handler).not.toHaveBeenCalled()
  })

  it("drops invalid JSON", () => {
    const pc = makePcStub()
    const t = new RemoteInputTransport(pc)
    const handler = vi.fn()
    t.onMessage(handler)
    t.handleChannelMessage("input", "not json")
    expect(handler).not.toHaveBeenCalled()
  })

  it("drops payloads that fail schema validation", () => {
    const pc = makePcStub()
    const t = new RemoteInputTransport(pc)
    const handler = vi.fn()
    t.onMessage(handler)
    t.handleChannelMessage("input", JSON.stringify({ type: "garbage" }))
    expect(handler).not.toHaveBeenCalled()
  })
})
