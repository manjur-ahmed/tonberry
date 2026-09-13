import { useEffect, useRef, useState } from 'react'
import { Navigation } from 'lucide-react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

// setOptions must be called exactly once, before the first importLibrary
// call — guarded at module scope since this component can mount many times
// (once per message in a chat) but the underlying script/config is global.
let configured = false
function ensureConfigured() {
  if (configured) return
  setOptions({ key: import.meta.env.VITE_GOOGLE_MAPS_BROWSER_API_KEY ?? '' })
  configured = true
}

interface RouteMapProps {
  encodedPolyline: string
  startLabel: string | null
  destinationLabel: string | null
}

interface LatLng {
  lat: number
  lng: number
}

// Google Maps' documented "Universal URL" for directions — works both as a
// plain web link and to hand off into the Google Maps app when installed
// (iOS/Android). Built from the route's own decoded start/end coordinates
// (not the place labels) so it always points at exactly the two ends of
// the real computed path, regardless of what "Your location" or a place
// name resolved to.
function googleMapsDirectionsUrl(start: LatLng, end: LatLng): string {
  const url = new URL('https://www.google.com/maps/dir/')
  url.searchParams.set('api', '1')
  url.searchParams.set('origin', `${start.lat},${start.lng}`)
  url.searchParams.set('destination', `${end.lat},${end.lng}`)
  url.searchParams.set('travelmode', 'walking')
  return url.toString()
}

// Renders a real Google-computed route: decodes Routes API's polyline (the
// `geometry` library's decodePath — this app never parses that string
// itself) and draws it, with a start marker and, for a genuine
// point-to-point route (destination different from the start), a
// destination marker too. Uses the classic `Marker` class (via the
// `marker` library) rather than `AdvancedMarkerElement` — Google's newer
// recommendation, but the classic one is still fully supported and simpler
// for a first version; nothing here would need to change to switch later.
function RouteMap({ encodedPolyline, startLabel, destinationLabel }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [endpoints, setEndpoints] = useState<{ start: LatLng; end: LatLng } | null>(null)

  useEffect(() => {
    let cancelled = false
    ensureConfigured()
    Promise.all([importLibrary('maps'), importLibrary('marker'), importLibrary('geometry')])
      .then(([{ Map, Polyline }, { Marker }, { encoding }]) => {
        if (cancelled || !containerRef.current) return
        const path = encoding.decodePath(encodedPolyline)
        if (path.length === 0) {
          setError("Couldn't render this route.")
          return
        }
        const map = new Map(containerRef.current, {
          center: path[0],
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
        })
        const bounds = new google.maps.LatLngBounds()
        path.forEach((point) => bounds.extend(point))
        map.fitBounds(bounds)
        new Polyline({ path, map, strokeColor: '#2563eb', strokeWeight: 4 })
        new Marker({ position: path[0], map, label: 'S', title: startLabel ?? 'Start' })
        const end = path[path.length - 1]
        if (destinationLabel && destinationLabel !== startLabel) {
          new Marker({ position: end, map, label: 'E', title: destinationLabel })
        }
        setEndpoints({
          start: { lat: path[0].lat(), lng: path[0].lng() },
          end: { lat: end.lat(), lng: end.lng() },
        })
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the map.")
      })
    return () => {
      cancelled = true
    }
    // encodedPolyline is the only prop that should ever actually change
    // (a message's route is fixed once sent) — start/destination labels
    // are read fresh inside the effect regardless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encodedPolyline])

  if (error) return <p className="text-sm text-red-600">{error}</p>
  return (
    <div>
      <div ref={containerRef} className="h-56 w-full overflow-hidden rounded-2xl border border-slate-200" />
      {endpoints && (
        <a
          href={googleMapsDirectionsUrl(endpoints.start, endpoints.end)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900"
        >
          <Navigation className="h-4 w-4" strokeWidth={2} />
          Open in Google Maps
        </a>
      )}
    </div>
  )
}

export default RouteMap
