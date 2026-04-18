const ADJECTIVES = [
  "amber",
  "azure",
  "cobalt",
  "coral",
  "crimson",
  "golden",
  "jade",
  "olive",
  "silver",
  "teal",
]

const NOUNS = ["bear", "eagle", "falcon", "fox", "hawk", "lion", "lynx", "otter", "tiger", "wolf"]

export function generateRoomSlug(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const num = Math.floor(Math.random() * 100)
  return `${adj}-${noun}-${num}`
}

export function parseRoomInput(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Full URL — extract the segment after /room/
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const match = trimmed.match(/\/room\/([^/?#]+)/)
    return match ? match[1] : null
  }

  return trimmed
}
