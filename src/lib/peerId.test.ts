import { getPeerId } from "./peerId"

describe("getPeerId", () => {
  beforeEach(() => localStorage.clear())

  it("generates a UUID for a new room", () => {
    const id = getPeerId("coral-tiger-42")
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it("returns the same ID on subsequent calls within TTL", () => {
    const a = getPeerId("coral-tiger-42")
    const b = getPeerId("coral-tiger-42")
    expect(a).toBe(b)
  })

  it("generates a new ID after TTL expires", () => {
    const key = "peer:coral-tiger-42"
    localStorage.setItem(key, JSON.stringify({ id: "old-id", expires: Date.now() - 1 }))
    const id = getPeerId("coral-tiger-42")
    expect(id).not.toBe("old-id")
  })

  it("generates different IDs for different rooms", () => {
    const a = getPeerId("room-a")
    const b = getPeerId("room-b")
    expect(a).not.toBe(b)
  })
})
