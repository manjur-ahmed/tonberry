import type { YoutubeVideo } from './youtube'

// Tracks the real video already resolved for a given guide (tech/home/car/
// diy — see tool-config.ts's guideKey), keyed by chatId+guideKey, so a
// guide that gets refined over several replies only ever triggers one real
// YouTube search, not one per reply. `null` means "already searched,
// genuinely nothing found" — distinct from never having searched at all —
// so a guide with no good match doesn't retry the search on every remount
// either. Same local-only, best-effort style as savedMessageItems.ts: lost
// on a different browser/device just means one extra search there, never
// an error.
const KEY = '101ai_resolved_guide_videos'

type VideoMap = Record<string, YoutubeVideo | null>

function read(): VideoMap {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as VideoMap) : {}
  } catch {
    return {}
  }
}

function write(map: VideoMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    // Storage unavailable (private mode, quota, etc.) — the search will
    // just be re-attempted next time, which is harmless (a real search
    // isn't a mutation, just a repeat network call).
  }
}

function cacheKey(chatId: string, guideKey: string): string {
  return `${chatId}:${guideKey}`
}

// undefined = never resolved yet (should fetch); null = resolved to "no
// video found" (should NOT re-fetch); a value = the real resolved video.
export function getResolvedVideoForGuide(chatId: string, guideKey: string): YoutubeVideo | null | undefined {
  const map = read()
  const key = cacheKey(chatId, guideKey)
  return key in map ? map[key] : undefined
}

export function markVideoResolvedForGuide(chatId: string, guideKey: string, video: YoutubeVideo | null) {
  const map = read()
  map[cacheKey(chatId, guideKey)] = video
  write(map)
}
