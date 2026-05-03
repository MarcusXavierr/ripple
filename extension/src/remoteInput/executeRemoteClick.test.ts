import { executeRemoteClick } from "./executeRemoteClick"

describe("executeRemoteClick", () => {
  it("dispatches pointer and mouse events at the target element", () => {
    document.body.innerHTML = `<button id="target">Click</button>`
    const target = document.getElementById("target") as HTMLButtonElement
    const events: string[] = []
    const composedFlags: boolean[] = []
    for (const eventName of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      target.addEventListener(eventName, (event) => {
        events.push(eventName)
        composedFlags.push(event.composed)
      })
    }

    const fromPoint = vi.fn().mockReturnValue(target)
    Object.defineProperty(document, "elementFromPoint", {
      value: fromPoint,
      configurable: true,
      writable: true,
    })

    const result = executeRemoteClick({ x: 20, y: 30 }, document)

    expect(result).toEqual({ ok: true, stage: "dispatched" })
    expect(events).toEqual(["pointerdown", "mousedown", "pointerup", "mouseup", "click"])
    expect(composedFlags).toEqual([true, true, true, true, true])
  })

  it("rejects when no element exists at the target point", () => {
    const fromPoint = vi.fn().mockReturnValue(null)
    Object.defineProperty(document, "elementFromPoint", {
      value: fromPoint,
      configurable: true,
      writable: true,
    })

    expect(executeRemoteClick({ x: 20, y: 30 }, document)).toEqual({
      ok: false,
      reason: "reason_click_target_not_found",
      stage: "target",
    })
  })

  it("focuses native text inputs after the remote click sequence", () => {
    document.body.innerHTML = `<input id="target" />`
    const target = document.getElementById("target") as HTMLInputElement
    Object.defineProperty(document, "elementFromPoint", {
      value: vi.fn().mockReturnValue(target),
      configurable: true,
      writable: true,
    })

    executeRemoteClick({ x: 20, y: 30 }, document)

    expect(document.activeElement).toBe(target)
  })

  it("does not force focus onto non-text controls", () => {
    document.body.innerHTML = `<button id="target" type="button">Click</button>`
    const target = document.getElementById("target") as HTMLButtonElement
    Object.defineProperty(document, "elementFromPoint", {
      value: vi.fn().mockReturnValue(target),
      configurable: true,
      writable: true,
    })

    executeRemoteClick({ x: 20, y: 30 }, document)

    expect(document.activeElement).not.toBe(target)
  })
})
