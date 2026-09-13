import { useState } from 'react'
import type { SavedRouteData } from './ResponseView'

function isSavedRouteData(value: unknown): value is SavedRouteData {
  if (!value || typeof value !== 'object') return false
  return 'encodedPolyline' in value
}

function formatDistance(meters: number | null): string | null {
  return meters === null ? null : `${(meters / 1000).toFixed(1)}km`
}

// A static (non-interactive) map image, not the live Maps JavaScript API —
// exactly what a grid tile needs (a quick visual, no pan/zoom), and much
// cheaper/lighter than mounting a real interactive map per tile. Same
// referrer-restricted browser key as the live map (see RouteMap.tsx) —
// Maps Static API is enabled separately in Google Cloud Console but reuses
// the same key. URLSearchParams (not manual string concatenation) so the
// polyline's own characters are correctly percent-encoded.
function staticMapUrl(encodedPolyline: string): string {
  const url = new URL('https://maps.googleapis.com/maps/api/staticmap')
  // 3:4 portrait to match the tile's own aspect ratio (see the <img>
  // below) — well under Maps Static API's 640x640 free-tier size cap.
  url.searchParams.set('size', '450x600')
  url.searchParams.set('path', `weight:3|color:0x2563eb|enc:${encodedPolyline}`)
  url.searchParams.set('key', import.meta.env.VITE_GOOGLE_MAPS_BROWSER_API_KEY ?? '')
  return url.toString()
}

// The tile shows a real static map thumbnail of the route plus its real
// distance — same "title + key facts" shape every other tool's tile uses,
// backed entirely by the real Routes API result (see ResponseView.tsx),
// never anything estimated here.
function StepsPlannerItemView({ title, data }: { title: string; data: unknown }) {
  const route = isSavedRouteData(data) ? data : null
  const distance = route ? formatDistance(route.distanceMeters) : null
  const [mapFailed, setMapFailed] = useState(false)

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {route?.encodedPolyline && !mapFailed && (
        <img
          src={staticMapUrl(route.encodedPolyline)}
          alt=""
          className="aspect-[3/4] w-full object-cover"
          onError={() => setMapFailed(true)}
        />
      )}
      <div className="p-4">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {distance && <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">{distance}</p>}
      </div>
    </div>
  )
}

export default StepsPlannerItemView
