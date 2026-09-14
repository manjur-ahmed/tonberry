import { API_URL, getToken } from './api'

// A real place Google's Places API resolved for a suggested activity (see
// api/src/activity-planner/activity-planner.controller.ts) — never a place
// the model guessed itself, same "AI proposes a type, real data verifies
// an actual venue" rule as Steps Planner's stop-finding.
export interface ActivityVenue {
  placeId: string
  displayName: string
  lat: number
  lng: number
}

// Best-effort from the caller's side too — day-activity/ResponseView.tsx
// just shows the card with no map/venue on a failure, same as News's
// best-effort article fetch.
export async function fetchActivityVenue(
  query: string,
  lat?: number,
  lng?: number,
): Promise<ActivityVenue | null> {
  try {
    const url = new URL(`${API_URL}/tools/day-activity/venue`)
    url.searchParams.set('q', query)
    if (lat !== undefined && lng !== undefined) {
      url.searchParams.set('lat', String(lat))
      url.searchParams.set('lng', String(lng))
    }
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (!response.ok) return null
    const body = await response.json()
    return body.venue ?? null
  } catch {
    return null
  }
}

// Same shape/params as the Steps Planner static map (see steps-planner/
// ItemView.tsx) but a single marker instead of a route path — this is a
// point venue, not a walking route.
export function staticMapUrl(lat: number, lng: number): string {
  const url = new URL('https://maps.googleapis.com/maps/api/staticmap')
  url.searchParams.set('center', `${lat},${lng}`)
  url.searchParams.set('zoom', '15')
  url.searchParams.set('size', '450x600')
  url.searchParams.set('markers', `color:0x2563eb|${lat},${lng}`)
  url.searchParams.set('key', import.meta.env.VITE_GOOGLE_MAPS_BROWSER_API_KEY ?? '')
  return url.toString()
}

// Google Maps' documented "Universal URL" for opening a SPECIFIC place
// (the search action, not directions — see steps-planner/RouteMap.tsx for
// the directions version this tool doesn't need, since there's no route,
// just a venue to look at). query_place_id pins it to the exact real
// venue Places resolved, not just a generic pin at these coordinates.
export function googleMapsPlaceUrl(venue: ActivityVenue): string {
  const url = new URL('https://www.google.com/maps/search/')
  url.searchParams.set('api', '1')
  url.searchParams.set('query', venue.displayName)
  url.searchParams.set('query_place_id', venue.placeId)
  return url.toString()
}
