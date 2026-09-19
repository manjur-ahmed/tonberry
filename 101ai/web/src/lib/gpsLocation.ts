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

// Resolves a real town/city name for a GPS coordinate — used by the new-
// chat compose sheet (ToolDashboard.tsx) to show "Near Birmingham — not
// you?" as a one-time checkpoint before the first location-dependent
// message goes out, in case the cached location is stale (the cache has a
// TTL, but only expires lazily on next read — this is the deliberate
// "did I actually move" check within that window). Deliberately not shown
// once a chat is already running (Chat.tsx) — that's the same clutter this
// was removed from before, reintroduced only where it earns its place. Same
// browser key already used for the interactive map (RouteMap.tsx loads the
// Maps JS SDK client-side with it) — no separate server round-trip needed,
// this is real data the browser already legitimately has (its own GPS
// reading), not something a model could hallucinate, so there's no
// "resolve it server-side" concern the way there is for e.g. a YouTube
// video id. Returns null on any failure — callers fall back to showing
// nothing rather than a broken checkpoint.
const PLACE_NAME_COMPONENT_PRIORITY = [
  'locality',
  'postal_town',
  'administrative_area_level_2',
  'administrative_area_level_1',
]

export async function reverseGeocodeToPlaceName(lat: number, lng: number): Promise<string | null> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_API_KEY
  if (!apiKey) return null
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    url.searchParams.set('latlng', `${lat},${lng}`)
    url.searchParams.set('key', apiKey)
    const response = await fetch(url.toString())
    if (!response.ok) return null
    const body = (await response.json()) as {
      status?: string
      results?: { address_components?: { long_name?: string; types?: string[] }[] }[]
    }
    if (body.status !== 'OK') return null
    for (const result of body.results ?? []) {
      for (const type of PLACE_NAME_COMPONENT_PRIORITY) {
        const component = result.address_components?.find((c) => c.types?.includes(type))
        if (component?.long_name) return component.long_name
      }
    }
    return null
  } catch {
    return null
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
