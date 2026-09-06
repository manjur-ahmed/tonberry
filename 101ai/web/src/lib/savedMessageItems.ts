// Tracks which messages' auto-saved items have already been saved
// successfully, so reopening a chat doesn't re-run (and re-show a spinner,
// or re-fail against the item limit for) a save that already succeeded.
const KEY = '101ai_saved_message_items'

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function write(messageIds: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(messageIds))
  } catch {
    // Storage unavailable (private mode, quota, etc.) — the save will just
    // be re-attempted next time, which is harmless (dedup keys make a
    // repeat save a no-op update rather than a duplicate).
  }
}

export function hasSavedItemForMessage(messageId: string): boolean {
  return read().includes(messageId)
}

export function markItemSavedForMessage(messageId: string) {
  const current = read()
  if (!current.includes(messageId)) write([...current, messageId])
}
