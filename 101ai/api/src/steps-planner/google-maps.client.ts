import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LatLng } from './route-geometry';

const ROUTES_ENDPOINT =
  'https://routes.googleapis.com/directions/v2:computeRoutes';
const PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const NEARBY_SEARCH_ENDPOINT =
  'https://places.googleapis.com/v1/places:searchNearby';
// Only pulling the fields this app actually uses, not the whole response —
// Routes API requires an explicit field mask on every request.
const ROUTES_FIELD_MASK =
  'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline';
const PLACES_FIELD_MASK = 'places.id,places.displayName,places.location';

export type RouteWaypoint =
  { location: { latLng: LatLng } } | { placeId: string };

export interface ComputedRoute {
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
}

export interface FoundPlace {
  placeId: string;
  lat: number;
  lng: number;
  displayName: string;
}

// Routes API's wire format for a coordinate is google.type.LatLng —
// {latitude, longitude} — not our own internal {lat, lng} shape (LatLng in
// route-geometry.ts). Sending {lat, lng} as-is gets a 400 "Unknown name
// lat/lng" back, so every waypoint is translated at this one boundary
// rather than renaming the field everywhere else it's used internally.
function toWireWaypoint(waypoint: RouteWaypoint): Record<string, unknown> {
  if ('placeId' in waypoint) return { placeId: waypoint.placeId };
  return {
    location: {
      latLng: {
        latitude: waypoint.location.latLng.lat,
        longitude: waypoint.location.latLng.lng,
      },
    },
  };
}

// Both calls are best-effort, same philosophy as GdeltClient — a live
// external API can fail, and that should degrade the reply gracefully
// (StepsPlannerService falls back to an honest "couldn't find a route"
// message) rather than break the whole chat turn. Unlike GDELT, these are
// paid, authenticated, well-provisioned Google APIs — no informal
// rate-limit/queue handling needed here.
//
// GOOGLE_API_KEY — the SAME key web/.env's VITE_GOOGLE_MAPS_BROWSER_API_KEY
// exposes to the browser (a deliberate choice, confirmed with the user, not
// the two-separate-keys design originally planned). Since one key can't be
// both HTTP-referrer-restricted (needed for the browser half) and
// unrestricted-by-referrer (needed for these server-side calls), the
// safety net here is API restriction instead: this key must be locked to
// only Routes API + Places API (New) + Maps JavaScript API + Maps Static
// API in Google Cloud Console, nothing broader.
@Injectable()
export class GoogleMapsClient {
  private readonly logger = new Logger(GoogleMapsClient.name);
  private readonly apiKey: string | undefined;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('GOOGLE_API_KEY');
  }

  async computeWalkingRoute(
    origin: RouteWaypoint,
    destination: RouteWaypoint,
    intermediates: RouteWaypoint[],
  ): Promise<ComputedRoute | null> {
    try {
      const response = await fetch(ROUTES_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey ?? '',
          'X-Goog-FieldMask': ROUTES_FIELD_MASK,
        },
        body: JSON.stringify({
          origin: toWireWaypoint(origin),
          destination: toWireWaypoint(destination),
          intermediates: intermediates.map(toWireWaypoint),
          travelMode: 'WALK',
        }),
      });
      if (!response.ok) {
        this.logger.warn(
          `Routes API returned ${response.status}: ${(await response.text()).slice(0, 200)}`,
        );
        return null;
      }
      const body = (await response.json()) as {
        routes?: {
          distanceMeters?: number;
          duration?: string;
          polyline?: { encodedPolyline?: string };
        }[];
      };
      const route = body.routes?.[0];
      if (!route?.polyline?.encodedPolyline) return null;
      return {
        distanceMeters: route.distanceMeters ?? 0,
        // Routes API returns duration as e.g. "1234s" — strip the trailing 's'.
        durationSeconds: Number.parseInt(route.duration ?? '0', 10),
        encodedPolyline: route.polyline.encodedPolyline,
      };
    } catch (error) {
      this.logger.warn(
        `Routes API request failed: ${(error as Error).message}`,
      );
      return null;
    }
  }

  // `near` (with `radiusMeters`) biases results toward a real location —
  // confirmed against the real API — without it, a generic query like
  // "escape room" can resolve to the wrong city or country entirely; used
  // by ActivityPlannerService to make sure a suggested activity resolves
  // to a real venue actually near the user, not just anywhere with that
  // name.
  async findPlace(
    query: string,
    near?: LatLng,
    radiusMeters = 20000,
  ): Promise<FoundPlace | null> {
    try {
      const response = await fetch(PLACES_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey ?? '',
          'X-Goog-FieldMask': PLACES_FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: query,
          pageSize: 1,
          ...(near
            ? {
                locationBias: {
                  circle: {
                    center: { latitude: near.lat, longitude: near.lng },
                    radius: Math.min(radiusMeters, 50000),
                  },
                },
              }
            : {}),
        }),
      });
      if (!response.ok) {
        this.logger.warn(
          `Places API returned ${response.status}: ${(await response.text()).slice(0, 200)}`,
        );
        return null;
      }
      const body = (await response.json()) as {
        places?: {
          id?: string;
          displayName?: { text?: string };
          location?: { latitude?: number; longitude?: number };
        }[];
      };
      const place = body.places?.[0];
      if (
        !place?.id ||
        place.location?.latitude === undefined ||
        place.location?.longitude === undefined
      ) {
        return null;
      }
      return {
        placeId: place.id,
        lat: place.location.latitude,
        lng: place.location.longitude,
        displayName: place.displayName?.text ?? query,
      };
    } catch (error) {
      this.logger.warn(
        `Places API request failed: ${(error as Error).message}`,
      );
      return null;
    }
  }

  // Real candidate stops/stations near a point, for StepsPlannerService's
  // "which tram stop should I get off at" flow — never a specific place
  // the model guessed, only places Google's own index actually returns
  // within the given radius. Empty array (not null) on any failure/no
  // match — callers already treat "no candidates found" as a normal,
  // reportable outcome rather than an exceptional one.
  async findNearbyStops(
    center: LatLng,
    radiusMeters: number,
    includedTypes: string[],
  ): Promise<FoundPlace[]> {
    try {
      const response = await fetch(NEARBY_SEARCH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey ?? '',
          'X-Goog-FieldMask': PLACES_FIELD_MASK,
        },
        body: JSON.stringify({
          includedTypes,
          maxResultCount: 10,
          locationRestriction: {
            circle: {
              center: { latitude: center.lat, longitude: center.lng },
              // Nearby Search's own hard cap — a bare clamp, not a design
              // choice: no walking-distance search should ever need more
              // than a fraction of this anyway.
              radius: Math.min(radiusMeters, 50000),
            },
          },
        }),
      });
      if (!response.ok) {
        this.logger.warn(
          `Nearby Search returned ${response.status}: ${(await response.text()).slice(0, 200)}`,
        );
        return [];
      }
      const body = (await response.json()) as {
        places?: {
          id?: string;
          displayName?: { text?: string };
          location?: { latitude?: number; longitude?: number };
        }[];
      };
      const results: FoundPlace[] = [];
      for (const place of body.places ?? []) {
        if (
          !place.id ||
          place.location?.latitude === undefined ||
          place.location?.longitude === undefined
        ) {
          continue;
        }
        results.push({
          placeId: place.id,
          lat: place.location.latitude,
          lng: place.location.longitude,
          displayName: place.displayName?.text ?? 'Unnamed stop',
        });
      }
      return results;
    } catch (error) {
      this.logger.warn(
        `Nearby Search request failed: ${(error as Error).message}`,
      );
      return [];
    }
  }
}
