// Pure geometry — no API calls, nothing async. The backend picks these
// waypoints deterministically (not the AI — see StepsPlannerService), so a
// loop's shape is always real, valid geographic math; only the AI's job is
// interpreting what the user wants, never inventing coordinates.

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_METERS = 6371000;

// A fixed, documented-as-approximate average stride length — never
// presented to the user as precise (see StepsPlannerService's reply text,
// always "about X steps"). Real stride length varies by height/pace/terrain
// far more than this constant could ever capture; the point is a reasonable
// ballpark for sizing a loop, not a fitness-tracker-grade conversion.
const METERS_PER_STEP = 0.75;

export function stepsToMeters(steps: number): number {
  return steps * METERS_PER_STEP;
}

export function metersToSteps(meters: number): number {
  return Math.round(meters / METERS_PER_STEP);
}

// Standard haversine "destination point given distance and bearing" —
// bearingDegrees measured clockwise from true north.
export function offsetLatLng(
  origin: LatLng,
  bearingDegrees: number,
  distanceMeters: number,
): LatLng {
  const bearingRad = (bearingDegrees * Math.PI) / 180;
  const latRad = (origin.lat * Math.PI) / 180;
  const lngRad = (origin.lng * Math.PI) / 180;
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;

  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearingRad),
  );
  const newLngRad =
    lngRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLatRad),
    );

  return {
    lat: (newLatRad * 180) / Math.PI,
    lng: (newLngRad * 180) / Math.PI,
  };
}

// Treats targetDistanceMeters as the loop's rough circumference
// (radius = circumference / 2π), placing 3 candidate waypoints 90° apart
// around the origin. Real streets/paths will make Routes API's actual
// computed distance longer or shorter than this — that's expected: this is
// a starting guess for what to ask Google to route through, not a claim
// about the final distance (see StepsPlannerService's single bounded retry
// for when the real result comes back way off target).
export function buildLoopWaypoints(
  origin: LatLng,
  targetDistanceMeters: number,
): LatLng[] {
  const radius = Math.max(targetDistanceMeters / (2 * Math.PI), 25);
  return [90, 180, 270].map((bearing) => offsetLatLng(origin, bearing, radius));
}

// Standard haversine great-circle distance between two points.
export function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const latRad1 = (a.lat * Math.PI) / 180;
  const latRad2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(latRad1) * Math.cos(latRad2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Standard initial-bearing formula — the compass direction from a to b,
// clockwise from true north.
export function initialBearingDegrees(a: LatLng, b: LatLng): number {
  const latRad1 = (a.lat * Math.PI) / 180;
  const latRad2 = (b.lat * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(latRad2);
  const x =
    Math.cos(latRad1) * Math.sin(latRad2) -
    Math.sin(latRad1) * Math.cos(latRad2) * Math.cos(dLng);
  const bearingRad = Math.atan2(y, x);
  return ((bearingRad * 180) / Math.PI + 360) % 360;
}

// A point-to-point walk with a step target needs to be padded out to
// roughly that distance, not just take the shortest path — e.g. "a 5k
// route to the tram stop" means detour on the way there, not report
// however short the direct route happens to be. Places one waypoint off
// to the side of the direct line so the two-leg path (start -> waypoint
// -> destination) has approximately targetDistanceMeters of straight-line
// length; like buildLoopWaypoints, this is a starting guess for what to
// route through; real streets make Google's actual result come out
// somewhat different (see StepsPlannerService's retry for that). Returns
// null when the direct distance already meets or exceeds the target —
// can't shorten a walk below its direct distance, so no detour is added.
export function buildDetourWaypoint(
  start: LatLng,
  destination: LatLng,
  targetDistanceMeters: number,
): LatLng | null {
  const direct = haversineDistanceMeters(start, destination);
  if (targetDistanceMeters <= direct) return null;
  const half = direct / 2;
  const halfTarget = targetDistanceMeters / 2;
  const offset = Math.sqrt(halfTarget * halfTarget - half * half);
  const bearing = initialBearingDegrees(start, destination);
  const midpoint = offsetLatLng(start, bearing, half);
  return offsetLatLng(midpoint, (bearing + 90) % 360, offset);
}
