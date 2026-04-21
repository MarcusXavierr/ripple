import { describe, it, expect } from "vitest"
import fc from "fast-check"
import { transition } from "./signalingFSM"
import type { FullMachineState, MachineEvent, MachineState } from "./signalingFSM"

const arbRole = fc.constantFrom("caller" as const, "callee" as const)

const arbState: fc.Arbitrary<FullMachineState> = fc.record({
  state: fc.constantFrom(
    "IDLE",
    "CONNECTING",
    "CALLER_WAITING",
    "CALLEE_WAITING",
    "NEGOTIATING",
    "CONNECTED"
  ),
  role: fc.option(arbRole, { nil: null }),
})

const arbEvent: fc.Arbitrary<MachineEvent> = fc.oneof(
  fc.record({ type: fc.constant("onopen"), role: arbRole, reconnect: fc.boolean() }),
  fc.constant({ type: "enter" as const }),
  fc.constant({ type: "peer-reconnected" as const }),
  fc.record({ type: fc.constant("onclose"), message: fc.string() }),
  fc.constant({ type: "ping" as const }),
  fc.record({
    type: fc.constant("offer"),
    offer: fc.record({ type: fc.constant("offer" as const), sdp: fc.string() }),
  }),
  fc.record({
    type: fc.constant("answer"),
    answer: fc.record({ type: fc.constant("answer" as const), sdp: fc.string() }),
  }),
  fc.record({
    type: fc.constant("ice-candidate"),
    candidate: fc.record({ candidate: fc.string() }),
  }),
  fc.constant({ type: "ice-connected" as const }),
  fc.constant({ type: "ice-failed" as const })
)

const arbEventSequence = fc.array(arbEvent, { minLength: 1, maxLength: 30 })

function runSequence(initial: FullMachineState, events: MachineEvent[]): FullMachineState {
  return events.reduce((s, e) => transition(s, e).next, initial)
}

describe("Signaling Machine Invariants", () => {
  it("never crashes on any (state, event) pair", () => {
    fc.assert(
      fc.property(arbState, arbEvent, (state, event) => {
        expect(() => transition(state, event)).not.toThrow()
      })
    )
  })

  it("CONNECTED is only reachable via ice-connected", () => {
    fc.assert(
      fc.property(arbState, arbEventSequence, (initial, events) => {
        let prev = initial
        for (const event of events) {
          const { next } = transition(prev, event)
          if (next.state === "CONNECTED" && prev.state !== "CONNECTED") {
            expect(event.type).toBe("ice-connected")
          }
          prev = next
        }
      })
    )
  })

  it("onclose in CONNECTED or NEGOTIATING always returns to a WAITING state", () => {
    fc.assert(
      fc.property(arbRole, (role) => {
        for (const state of ["CONNECTED", "NEGOTIATING"] as MachineState[]) {
          const { next } = transition({ state, role }, { type: "onclose", message: "bye" })
          expect(["CALLER_WAITING", "CALLEE_WAITING"]).toContain(next.state)
        }
      })
    )
  })

  it("callee never emits ROLLBACK_AND_RESTART_ICE", () => {
    fc.assert(
      fc.property(arbEventSequence, (events) => {
        let state: FullMachineState = { state: "CALLEE_WAITING", role: "callee" }
        for (const event of events) {
          const { next, effects } = transition(state, event)
          expect(effects.some((e) => e.type === "ROLLBACK_AND_RESTART_ICE")).toBe(false)
          state = next
        }
      })
    )
  })

  it("role is immutable once set", () => {
    fc.assert(
      fc.property(arbState, arbEventSequence, (initial, events) => {
        const final = runSequence(initial, events)
        if (initial.role !== null) {
          expect(final.role).toBe(initial.role)
        }
      })
    )
  })

  it("ping always produces exactly SEND_WS(pong) regardless of state", () => {
    fc.assert(
      fc.property(arbState, (state) => {
        const { effects } = transition(state, { type: "ping" })
        expect(effects).toHaveLength(1)
        expect(effects[0]).toEqual({ type: "SEND_WS", msg: { type: "pong" } })
      })
    )
  })

  it("after onclose, a subsequent enter/offer produces NEGOTIATING (F5 bug regression)", () => {
    fc.assert(
      fc.property(arbRole, (role) => {
        const afterOnclose = transition(
          { state: "CONNECTED", role },
          { type: "onclose", message: "bye" }
        ).next

        const followUp: MachineEvent =
          role === "caller"
            ? { type: "enter" }
            : { type: "offer", offer: { type: "offer", sdp: "v=0" } }

        const { next } = transition(afterOnclose, followUp)
        expect(next.state).toBe("NEGOTIATING")
      })
    )
  })

  function isCoherent(state: FullMachineState): boolean {
    if (state.state === "IDLE" || state.state === "CONNECTING") return true
    if (state.state === "CALLER_WAITING" && state.role === "caller") return true
    if (state.state === "CALLEE_WAITING" && state.role === "callee") return true
    if ((state.state === "NEGOTIATING" || state.state === "CONNECTED") && state.role !== null)
      return true
    return false
  }

  it("role/state coherence: role matches state, null iff IDLE/CONNECTING", () => {
    fc.assert(
      fc.property(arbState, arbEventSequence, (initial, events) => {
        fc.pre(isCoherent(initial))
        const final = runSequence(initial, events)
        if (final.state === "IDLE" || final.state === "CONNECTING") {
          return
        }
        if (final.state === "CALLER_WAITING") expect(final.role).toBe("caller")
        if (final.state === "CALLEE_WAITING") expect(final.role).toBe("callee")
        if (final.state === "NEGOTIATING" || final.state === "CONNECTED") {
          expect(final.role).not.toBeNull()
        }
      })
    )
  })

  it("WARN fallthrough: WARN ⇔ state unchanged AND no other effect fired", () => {
    fc.assert(
      fc.property(arbState, arbEvent, (state, event) => {
        const { next, effects } = transition(state, event)
        const hasWarn = effects.some((e) => e.type === "WARN")
        if (hasWarn) {
          expect(next).toEqual(state)
          expect(effects.filter((e) => e.type !== "WARN")).toHaveLength(0)
        }
      })
    )
  })

  it("ice-connected is the only way to enter CONNECTED, and only from NEGOTIATING", () => {
    fc.assert(
      fc.property(arbState, arbEvent, (state, event) => {
        const { next } = transition(state, event)
        if (next.state === "CONNECTED" && state.state !== "CONNECTED") {
          expect(state.state).toBe("NEGOTIATING")
          expect(event.type).toBe("ice-connected")
        }
      })
    )
  })

  it("SETUP_PC coupling: emitted ⇔ onopen or peer-reconnected(callee), next.state matches role", () => {
    fc.assert(
      fc.property(arbState, arbEvent, (state, event) => {
        const { next, effects } = transition(state, event)
        const setup = effects.find((e) => e.type === "SETUP_PC")
        if (setup && setup.type === "SETUP_PC") {
          const validTrigger =
            event.type === "onopen" ||
            (event.type === "peer-reconnected" && state.role === "callee")
          expect(validTrigger).toBe(true)
          const expected = setup.role === "caller" ? "CALLER_WAITING" : "CALLEE_WAITING"
          expect(next.state).toBe(expected)
        }
        if (event.type === "onopen") {
          expect(effects.some((e) => e.type === "SETUP_PC")).toBe(true)
        }
      })
    )
  })

  it("RESET_PC coupling: only from onclose or peer-reconnected out of NEGOTIATING or CONNECTED", () => {
    fc.assert(
      fc.property(arbState, arbEvent, (state, event) => {
        const { next, effects } = transition(state, event)
        if (effects.some((e) => e.type === "RESET_PC")) {
          expect(["onclose", "peer-reconnected"]).toContain(event.type)
          expect(["NEGOTIATING", "CONNECTED"]).toContain(state.state)
          expect(["CALLER_WAITING", "CALLEE_WAITING"]).toContain(next.state)
        }
      })
    )
  })

  it("two-machine: premature offer (onnegotiationneeded before enter) — answer must not be WARNed in CALLER_WAITING", () => {
    let caller: FullMachineState = { state: "CONNECTED", role: "caller" }
    let callee: FullMachineState = { state: "CONNECTED", role: "callee" }

    // Caller refreshes, callee notified
    caller = transition(caller, { type: "onopen", role: "caller", reconnect: true }).next
    callee = transition(callee, { type: "peer-reconnected" }).next
    expect(caller.state).toBe("CALLER_WAITING")
    expect(callee.state).toBe("CALLEE_WAITING")

    // onnegotiationneeded fires on caller's PC before enter — offer sent outside FSM
    // Callee processes it normally
    callee = transition(callee, { type: "offer", offer: { type: "offer", sdp: "v=0" } }).next
    expect(callee.state).toBe("NEGOTIATING")

    // Answer comes back to caller — caller is still CALLER_WAITING
    // This is the bug: currently WARN'd and ignored, leaving caller stuck
    const { next: callerAfterAnswer, effects } = transition(caller, {
      type: "answer",
      answer: { type: "answer", sdp: "v=0" },
    })
    expect(effects.some((e) => e.type === "WARN")).toBe(false)
    expect(callerAfterAnswer.state).toBe("NEGOTIATING")
  })

  it("two-machine: full reconnection — both machines reach CONNECTED", () => {
    let caller: FullMachineState = { state: "CONNECTED", role: "caller" }
    let callee: FullMachineState = { state: "CONNECTED", role: "callee" }

    caller = transition(caller, { type: "onopen", role: "caller", reconnect: true }).next
    callee = transition(callee, { type: "peer-reconnected" }).next
    callee = transition(callee, { type: "offer", offer: { type: "offer", sdp: "v=0" } }).next
    caller = transition(caller, { type: "answer", answer: { type: "answer", sdp: "v=0" } }).next

    caller = transition(caller, { type: "ice-connected" }).next
    callee = transition(callee, { type: "ice-connected" }).next

    expect(caller.state).toBe("CONNECTED")
    expect(callee.state).toBe("CONNECTED")
  })

  it("peer-reconnected as callee in CONNECTED or NEGOTIATING resets to CALLEE_WAITING with fresh PC", () => {
    for (const state of ["CONNECTED", "NEGOTIATING"] as MachineState[]) {
      const { next, effects } = transition({ state, role: "callee" }, { type: "peer-reconnected" })
      expect(next.state).toBe("CALLEE_WAITING")
      expect(effects.some((e) => e.type === "RESET_PC")).toBe(true)
      expect(effects.some((e) => e.type === "SETUP_PC")).toBe(true)
    }
  })

  it("after peer-reconnected as callee, a subsequent offer produces NEGOTIATING", () => {
    const afterReconnect = transition(
      { state: "CONNECTED", role: "callee" },
      { type: "peer-reconnected" }
    ).next

    const { next } = transition(afterReconnect, {
      type: "offer",
      offer: { type: "offer", sdp: "v=0" },
    })
    expect(next.state).toBe("NEGOTIATING")
  })
})
