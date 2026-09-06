// Tracks which chats have already shown the "ran out of item space" banner
// — once a chat has shown it, it shouldn't show again even if another
// message in that chat also fails to save for the same reason.
const KEY = '101ai_item_limit_notices_seen'

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function write(chatIds: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(chatIds))
  } catch {
    // Storage unavailable (private mode, quota, etc.) — the banner just
    // might show again next time, which is harmless.
  }
}

export function hasSeenItemLimitNotice(chatId: string): boolean {
  return read().includes(chatId)
}

export function markItemLimitNoticeSeen(chatId: string) {
  const current = read()
  if (!current.includes(chatId)) write([...current, chatId])
}
