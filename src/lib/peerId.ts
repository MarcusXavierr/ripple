const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function getPeerId(roomId: string): string {
  const key = `peer:${roomId}`;
  const stored = localStorage.getItem(key);

  if (stored) {
    const parsed = JSON.parse(stored) as { id: string; expires: number };
    if (Date.now() < parsed.expires) {
      return parsed.id;
    }
    localStorage.removeItem(key);
  }

  const id = crypto.randomUUID();
  localStorage.setItem(key, JSON.stringify({ id, expires: Date.now() + TTL_MS }));
  return id;
}
