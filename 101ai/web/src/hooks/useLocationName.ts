import { useQuery } from '@tanstack/react-query'
import { reverseGeocodeToPlaceName } from '../lib/gpsLocation'

// Resolves a real town/city name for the user's cached GPS location — see
// gpsLocation.ts's reverseGeocodeToPlaceName for where this is actually
// shown and why (the new-chat compose sheet only). staleTime: Infinity + a
// query key keyed on the actual coordinates means this only ever fires once
// per distinct location, not on every render — and falls back to undefined
// (callers show nothing extra) while loading or if the reverse-geocode
// call fails.
export function useLocationName(location: { lat: number; lng: number } | null) {
  return useQuery({
    queryKey: ['reverse-geocode', location?.lat, location?.lng],
    queryFn: () => reverseGeocodeToPlaceName(location!.lat, location!.lng),
    enabled: !!location,
    staleTime: Infinity,
  })
}
