// Caches the browser's last-granted GPS location so the user doesn't have
// to click "Allow location" again every time they start a new chat within
// the same browsing session — plain localStorage, per device, never sent
// anywhere until the user actually sends a message. Shared across every
// tool that needs "where the user actually is" (Steps Planner's routes,
// Activity Planner's nearby venues, ...) rather than a separate cache and
// permission prompt per tool. A short TTL (not "forever") means a real
// location change (the user's actually moved) doesn't silently persist for
// days; letting it expire just brings back the normal "Allow location"
// prompt rather than failing anything.
const STORAGE_KEY = 'gps-location'
const TTL_MS = 20 * 60 * 1000

export interface CachedGpsLocation {
  lat: number
  lng: number
}

export function getCachedGpsLocation(): CachedGpsLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { lat: number; lng: number; savedAt: number }
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > TTL_MS) return null
    return { lat: parsed.lat, lng: parsed.lng }
  } catch {
    return null
  }
}

export function setCachedGpsLocation(location: CachedGpsLocation): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...location, savedAt: Date.now() }))
  } catch {
    // Private browsing / storage disabled — worst case, the next chat just
    // asks for location again, same as today.
  }
}

// Whether the browser will actually re-prompt the user if we call
// getCurrentPosition right now. Chrome/Firefox/Edge support querying this;
// Safari doesn't (query throws or the call is missing entirely) — callers
// should fall back to showing the "Allow location" banner in that case,
// same as if this returned 'prompt'.
export async function queryGeolocationPermission(): Promise<
  'granted' | 'prompt' | 'denied' | 'unsupported'
> {
  try {
    if (!navigator.permissions?.query) return 'unsupported'
    const status = await navigator.permissions.query({
      name: 'geolocation' as PermissionName,
    })
    return status.state
  } catch {
    return 'unsupported'
  }
}
