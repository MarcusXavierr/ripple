// @vitest-environment node
import { describe, expect, it } from "vitest"
import { generateRoomSlug, parseRoomInput } from "./room"

describe("generateRoomSlug", () => {
  it("returns a string matching adjective-noun-number format", () => {
    const slug = generateRoomSlug()
    expect(slug).toMatch(/^[a-z]+-[a-z]+-\d+$/)
  })

  it("produces different slugs on repeated calls", () => {
    const slugs = new Set(Array.from({ length: 20 }, generateRoomSlug))
    expect(slugs.size).toBeGreaterThan(1)
  })
})

describe("parseRoomInput", () => {
  it("returns null for empty string", () => {
    expect(parseRoomInput("")).toBeNull()
    expect(parseRoomInput("   ")).toBeNull()
  })

  it("returns the room ID for a bare room ID", () => {
    expect(parseRoomInput("coral-tiger-42")).toBe("coral-tiger-42")
  })

  it("trims whitespace from bare room IDs", () => {
    expect(parseRoomInput("  coral-tiger-42  ")).toBe("coral-tiger-42")
  })

  it("extracts room ID from a full URL", () => {
    expect(parseRoomInput("http://localhost:5173/room/coral-tiger-42")).toBe("coral-tiger-42")
    expect(parseRoomInput("https://ripple.example.com/room/coral-tiger-42")).toBe("coral-tiger-42")
  })

  it("returns null for a URL without /room/ in the path", () => {
    expect(parseRoomInput("https://example.com/other/path")).toBeNull()
  })
})
