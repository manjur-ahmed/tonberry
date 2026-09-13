import { Injectable } from '@nestjs/common';
import { HistoryMessage, OpenAiService } from '../openai/openai.service';
import {
  ComputedRoute,
  FoundPlace,
  GoogleMapsClient,
  RouteWaypoint,
} from './google-maps.client';
import {
  buildDetourWaypoint,
  buildLoopWaypoints,
  metersToSteps,
  stepsToMeters,
  LatLng,
} from './route-geometry';

// If the real route Google finds is way off the requested distance (a
// blind geometric guess can't account for real streets), one rescale-and-
// retry — never an unbounded search for a "perfect" match. The retry uses
// the ratio between what was asked for and what came back to size a new
// radius, then accepts whatever Google returns the second time as final.
const RETRY_DISTANCE_RATIO_THRESHOLD = 0.4;

export interface StepsPlanResult {
  replyText: string;
  distanceMeters: number | null;
  durationSeconds: number | null;
  encodedPolyline: string | null;
  startLabel: string | null;
  destinationLabel: string | null;
  // See planRoute's continuation handling — a stable id shared by every
  // message in the same "tweak this route" thread, so ChatsService can
  // persist it and the frontend can save/update ONE item across a whole
  // back-and-forth instead of a new item per message.
  routeThreadId: string | null;
}

// What ChatsService knows about the last successful route in this chat
// (derived from the last assistant message with a real polyline) — lets a
// short follow-up like "shorter" or "5k route" carry on that same route
// instead of the model having to re-derive everything from scratch each
// turn. distanceMeters is the *real* Routes API result, used as the
// "about the same as before" baseline when a tweak doesn't give a new
// number of its own.
export interface PreviousRouteInfo {
  threadId: string;
  mode: 'loop' | 'point_to_point';
  startLabel: string;
  destinationLabel: string;
  distanceMeters: number;
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 6) / 10} hr`;
}

const NO_ROUTE_REPLY =
  "Couldn't find a walkable route for that — try a different starting point or destination.";

// How many real nearby candidates to check via the Routes API when
// recommending a stop (see planRoute's stop-finding branch) — bounded on
// purpose, never an unbounded search: enough real candidates to usually
// find one close to the target distance without the request turning into
// a dozen sequential Routes API calls.
const MAX_STOP_CANDIDATES = 8;

// A "nearest stop" request (no distance mentioned or implied at all) has
// no real target to size a search radius from — this is just a generous
// default covering most in-city walking-distance searches.
const DEFAULT_NEAREST_SEARCH_RADIUS_METERS = 3000;

// What to search/rank stop candidates against, or null if there's truly
// nothing to go on yet (no number given, not a "nearest" request, no
// previous route in this chat to reuse) — the only case that should still
// ask the user "how far?" A stated number always wins; "nearest" (no
// number) searches a generous default radius and ranks by the SMALLEST
// real distance (see findBestStop's rankTarget: 0 does this for free);
// otherwise a continuing chat's last real distance is a reasonable guess.
function resolveStopSearchTarget(
  requestedTargetSteps: number | null,
  nearestOnly: boolean,
  previousRoute: PreviousRouteInfo | null,
): { rankTarget: number; searchRadius: number } | null {
  if (requestedTargetSteps) {
    const meters = stepsToMeters(requestedTargetSteps);
    return { rankTarget: meters, searchRadius: meters * 1.5 };
  }
  if (nearestOnly) {
    return { rankTarget: 0, searchRadius: DEFAULT_NEAREST_SEARCH_RADIUS_METERS };
  }
  if (previousRoute) {
    return {
      rankTarget: previousRoute.distanceMeters,
      searchRadius: previousRoute.distanceMeters * 1.5,
    };
  }
  return null;
}

// A last-resort net when the user's actual category has no real match
// nearby — deliberately NOT mixed into the specific searches below: Google
// tags plenty of unrelated transit (e.g. a coach station) as this same
// generic type, and blending it into a "tram stop" search would let a
// coach station outrank a real tram stop just for being closer to the
// target distance. Only reached for when the specific search below comes
// back with zero real candidates.
const GENERIC_TRANSIT_TYPE = 'transit_station';

// Maps a free-text category the model extracted (e.g. "tram stop", "bus
// station") to specific Places API (New) type enum(s) to search for —
// verified against Google's own real UK transit data (searchNearby's
// `places.types` field), not just the docs' summary table: real Midland
// Metro tram stops come back tagged "tram_stop", NOT "light_rail_station"
// as the general docs implied — that mismatch was silently sending every
// UK tram search to zero strict results and falling through to the
// generic net (which is how a coach/train station ended up recommended
// for a "tram stop" ask). Both are included per category so a differently
// tagged transit system elsewhere isn't missed either.
function stopTypesForCategory(category: string): string[] {
  const normalized = category.toLowerCase();
  if (
    normalized.includes('tram') ||
    normalized.includes('light rail') ||
    normalized.includes('metro')
  ) {
    return ['tram_stop', 'light_rail_station'];
  }
  if (normalized.includes('subway') || normalized.includes('underground')) {
    return ['subway_station'];
  }
  if (normalized.includes('train') || normalized.includes('rail')) {
    return ['train_station'];
  }
  if (normalized.includes('bus')) {
    return ['bus_stop', 'bus_station'];
  }
  return [GENERIC_TRANSIT_TYPE];
}

// Whether two place names plausibly refer to the SAME place — the model
// doesn't reliably follow the "leave this null to continue the previous
// route" instruction; it sometimes restates a place it already named
// (often abbreviated/reworded differently, e.g. "10X Brindley Pl" vs
// "Brindley Place"), which a strict null-check would wrongly read as
// naming a genuinely NEW place and break continuation. A shared
// significant word is treated as the same place; this is a coarse
// heuristic; not aiming for perfect name resolution, only good enough to
// tell "restated the same place" apart from "named a different one".
function namesLikelySamePlace(a: string, b: string): boolean {
  const tokenize = (value: string) =>
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((word) => word.length > 2),
    );
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  for (const token of tokensA) {
    if (tokensB.has(token)) return true;
  }
  return false;
}

@Injectable()
export class StepsPlannerService {
  constructor(
    private readonly openai: OpenAiService,
    private readonly maps: GoogleMapsClient,
  ) {}

  // The one entry point ChatsService calls for a Steps Planner message.
  // Mirrors NewsService's shape: a small AI call interprets *intent* only
  // (never invents a route itself — see OpenAiService.extractRouteIntent),
  // real geometry + a real Routes API call produce the actual path, and
  // the reply text describing the result is built deterministically from
  // those real numbers, not written by the model.
  async planRoute(
    message: string,
    userId: string,
    chatId: string,
    gpsLocation: LatLng | null,
    newMessageId: string,
    history: HistoryMessage[] = [],
    previousRoute: PreviousRouteInfo | null = null,
  ): Promise<StepsPlanResult> {
    const intent = await this.openai.extractRouteIntent(
      message,
      gpsLocation !== null,
      userId,
      chatId,
      history,
    );

    if (intent.kind === 'chat') {
      return {
        replyText: intent.reply,
        distanceMeters: null,
        durationSeconds: null,
        encodedPolyline: null,
        startLabel: null,
        destinationLabel: null,
        routeThreadId: null,
      };
    }

    // A turn that names no place, OR only restates the SAME place already
    // established in this chat (not a strict null-check — see
    // namesLikelySamePlace: the model doesn't reliably leave these null on
    // a pure tweak, it sometimes restates a reworded version of the place
    // it already gave), is treated as continuing that route rather than
    // starting an unrelated one. Naming a genuinely DIFFERENT place always
    // means a new, unrelated route/thread.
    const destinationIsSameOrUnset =
      !intent.destinationName ||
      (previousRoute !== null &&
        namesLikelySamePlace(intent.destinationName, previousRoute.destinationLabel));
    const startIsSameOrUnset =
      !intent.startLocationName ||
      (previousRoute !== null &&
        previousRoute.startLabel !== 'Your location' &&
        namesLikelySamePlace(intent.startLocationName, previousRoute.startLabel));
    const isContinuation =
      previousRoute !== null && destinationIsSameOrUnset && startIsSameOrUnset;
    const routeThreadId = isContinuation ? previousRoute!.threadId : newMessageId;
    const effectiveMode: 'loop' | 'point_to_point' =
      intent.mode ?? (isContinuation ? previousRoute!.mode : 'loop');

    const effectiveDestinationName =
      intent.destinationName ??
      (isContinuation && previousRoute!.mode === 'point_to_point'
        ? previousRoute!.destinationLabel
        : null);

    // "Which tram stop should I get off at to walk to work" — the model
    // names a CATEGORY, never a specific guessed stop (see
    // OpenAiService's prompt), so the app finds and checks real candidates
    // itself rather than trusting a name the model can't actually verify
    // the distance of. Bypasses the normal start-point resolution below
    // entirely, since the whole point is that the start isn't known yet.
    if (intent.startCategory && effectiveDestinationName) {
      return this.recommendStopToDestination(
        intent.startCategory,
        effectiveDestinationName,
        intent.targetSteps,
        intent.nearestOnly,
        isContinuation ? previousRoute : null,
        routeThreadId,
      );
    }

    // Resolve the start point — a named place takes priority over GPS if
    // the user mentioned one (e.g. "from Dudley town centre" overrides
    // wherever they're actually standing). Continuing a previous route
    // reuses its start label too, unless that start was itself "Your
    // location" — then the live gpsLocation below is just as good and
    // doesn't need a redundant Places lookup.
    const effectiveStartLocationName =
      intent.startLocationName ??
      (isContinuation && previousRoute!.startLabel !== 'Your location'
        ? previousRoute!.startLabel
        : null);
    let startPoint: LatLng;
    let startLabel: string;
    if (effectiveStartLocationName) {
      const found = await this.maps.findPlace(effectiveStartLocationName);
      if (!found) {
        return {
          replyText: `Couldn't find "${effectiveStartLocationName}" — try a different starting point.`,
          distanceMeters: null,
          durationSeconds: null,
          encodedPolyline: null,
          startLabel: null,
          destinationLabel: null,
          routeThreadId: null,
        };
      }
      startPoint = { lat: found.lat, lng: found.lng };
      startLabel = found.displayName;
    } else if (gpsLocation) {
      startPoint = gpsLocation;
      startLabel = 'Your location';
    } else {
      // extractRouteIntent should already have returned kind: 'chat' for
      // this case — defensive fallback, not an expected path.
      return {
        replyText: 'Where should the route start from?',
        distanceMeters: null,
        durationSeconds: null,
        encodedPolyline: null,
        startLabel: null,
        destinationLabel: null,
        routeThreadId: null,
      };
    }
    const origin: RouteWaypoint = { location: { latLng: startPoint } };

    // "Which tram stop is 2.5k steps away from me" — no destination named
    // at all, just a category and a target distance from wherever the
    // walk starts. Same real-candidates-only rule as the destination-
    // anchored version above, just searching around the START instead and
    // routing outward to each candidate rather than in toward a fixed end
    // point.
    if (intent.startCategory) {
      return this.recommendStopFromStart(
        intent.startCategory,
        startPoint,
        startLabel,
        intent.targetSteps,
        intent.nearestOnly,
        isContinuation ? previousRoute : null,
        routeThreadId,
      );
    }

    if (effectiveMode === 'point_to_point' && effectiveDestinationName) {
      const destination = await this.maps.findPlace(effectiveDestinationName);
      if (!destination) {
        return {
          replyText: `Couldn't find "${effectiveDestinationName}" — try a different destination.`,
          distanceMeters: null,
          durationSeconds: null,
          encodedPolyline: null,
          startLabel,
          destinationLabel: null,
          routeThreadId: null,
        };
      }
      const destinationPoint: LatLng = { lat: destination.lat, lng: destination.lng };
      const targetMeters = intent.targetSteps
        ? stepsToMeters(intent.targetSteps)
        : isContinuation
          ? previousRoute!.distanceMeters
          : null;
      // With a step target, don't just take the shortest path there — pad
      // it out with a detour waypoint so the whole walk is roughly that
      // long (see buildDetourWaypoint). No target (or one the direct route
      // already meets/exceeds) means no detour: the direct route is the
      // answer, reported honestly.
      const detour = targetMeters
        ? buildDetourWaypoint(startPoint, destinationPoint, targetMeters)
        : null;
      const intermediates: RouteWaypoint[] = detour
        ? [{ location: { latLng: detour } }]
        : [];
      let route = await this.maps.computeWalkingRoute(
        origin,
        { placeId: destination.placeId },
        intermediates,
      );

      if (
        route &&
        targetMeters &&
        Math.abs(route.distanceMeters - targetMeters) / targetMeters >
          RETRY_DISTANCE_RATIO_THRESHOLD
      ) {
        const scale = targetMeters / route.distanceMeters;
        const retriedDetour = buildDetourWaypoint(
          startPoint,
          destinationPoint,
          targetMeters * scale,
        );
        const retried = await this.maps.computeWalkingRoute(
          origin,
          { placeId: destination.placeId },
          retriedDetour ? [{ location: { latLng: retriedDetour } }] : [],
        );
        if (retried) route = retried;
      }

      if (!route) {
        return {
          replyText: NO_ROUTE_REPLY,
          distanceMeters: null,
          durationSeconds: null,
          encodedPolyline: null,
          startLabel,
          destinationLabel: destination.displayName,
          routeThreadId: null,
        };
      }
      return {
        replyText: `Route to ${destination.displayName}: about ${(route.distanceMeters / 1000).toFixed(1)}km (~${metersToSteps(route.distanceMeters)} steps), ${formatDuration(route.durationSeconds)}.`,
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
        encodedPolyline: route.encodedPolyline,
        startLabel,
        destinationLabel: destination.displayName,
        routeThreadId,
      };
    }

    // Loop: destination === origin. targetSteps falls back to the previous
    // route's actual distance when continuing one with no new number given,
    // else a reasonable default (2,000 steps, ~1.5km) — still better than
    // refusing to build anything.
    const targetMeters = intent.targetSteps
      ? stepsToMeters(intent.targetSteps)
      : isContinuation
        ? previousRoute!.distanceMeters
        : stepsToMeters(2000);
    let waypoints = buildLoopWaypoints(startPoint, targetMeters);
    let route = await this.maps.computeWalkingRoute(
      origin,
      origin,
      waypoints.map((point): RouteWaypoint => ({
        location: { latLng: point },
      })),
    );

    if (
      route &&
      Math.abs(route.distanceMeters - targetMeters) / targetMeters >
        RETRY_DISTANCE_RATIO_THRESHOLD
    ) {
      const scale = targetMeters / route.distanceMeters;
      waypoints = buildLoopWaypoints(startPoint, targetMeters * scale);
      const retried = await this.maps.computeWalkingRoute(
        origin,
        origin,
        waypoints.map((point): RouteWaypoint => ({
          location: { latLng: point },
        })),
      );
      if (retried) route = retried;
    }

    if (!route) {
      return {
        replyText: NO_ROUTE_REPLY,
        distanceMeters: null,
        durationSeconds: null,
        encodedPolyline: null,
        startLabel,
        destinationLabel: null,
        routeThreadId: null,
      };
    }
    return {
      replyText: `Found a walking loop from ${startLabel}: about ${(route.distanceMeters / 1000).toFixed(1)}km (~${metersToSteps(route.distanceMeters)} steps), ${formatDuration(route.durationSeconds)}.`,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      encodedPolyline: route.encodedPolyline,
      startLabel,
      destinationLabel: startLabel,
      routeThreadId,
    };
  }

  // Shared core for both stop-recommendation directions below: real
  // candidate stops/stations near `anchorPoint` (Places Nearby Search),
  // each one's REAL walking distance to/from `anchorWaypoint` checked via
  // the Routes API, returning whichever comes closest to `rankTarget` — or
  // null if nothing nearby turned out to be routable. rankTarget is 0 for
  // a "nearest one" request (see recommendStop*'s nearestOnly handling),
  // which naturally picks whichever candidate has the SMALLEST real
  // distance, since that's what's closest to zero. Never guesses a
  // specific stop name itself (see OpenAiService's startCategory prompt);
  // every candidate considered here actually exists and its distance is
  // actually computed, same "real data, not invented" rule as everywhere
  // else in this service.
  private async findBestStop(
    category: string,
    rankTarget: number,
    searchRadius: number,
    anchorPoint: LatLng,
    anchorWaypoint: RouteWaypoint,
    // true: the anchor is the DESTINATION, route computed candidate ->
    // anchor (recommending where to get OFF). false: the anchor is the
    // START, route computed anchor -> candidate (recommending where to
    // walk TO).
    anchorIsDestination: boolean,
  ): Promise<{ candidate: FoundPlace; route: ComputedRoute } | null> {
    const specificTypes = stopTypesForCategory(category);
    let candidates = await this.maps.findNearbyStops(
      anchorPoint,
      searchRadius,
      specificTypes,
    );
    // Only reach for the generic net when the specific type truly found
    // nothing nearby — never blend it in upfront, or an unrelated stop
    // (a coach station, say) could outrank a real match of the type
    // actually asked for just by sitting closer to the target distance.
    if (candidates.length === 0 && specificTypes[0] !== GENERIC_TRANSIT_TYPE) {
      candidates = await this.maps.findNearbyStops(anchorPoint, searchRadius, [
        GENERIC_TRANSIT_TYPE,
      ]);
    }
    if (candidates.length === 0) return null;

    const evaluated = await Promise.all(
      candidates.slice(0, MAX_STOP_CANDIDATES).map(async (candidate) => {
        const candidateWaypoint: RouteWaypoint = { placeId: candidate.placeId };
        const route = anchorIsDestination
          ? await this.maps.computeWalkingRoute(candidateWaypoint, anchorWaypoint, [])
          : await this.maps.computeWalkingRoute(anchorWaypoint, candidateWaypoint, []);
        return { candidate, route };
      }),
    );
    const viable = evaluated.filter(
      (entry): entry is { candidate: FoundPlace; route: ComputedRoute } =>
        entry.route !== null,
    );
    if (viable.length === 0) return null;
    return viable.reduce((closest, entry) =>
      Math.abs(entry.route.distanceMeters - rankTarget) <
      Math.abs(closest.route.distanceMeters - rankTarget)
        ? entry
        : closest,
    );
  }

  // "Which tram stop should I get off at to walk to work" — a fixed
  // destination, recommending where to start from.
  private async recommendStopToDestination(
    category: string,
    destinationName: string,
    requestedTargetSteps: number | null,
    nearestOnly: boolean,
    previousRoute: PreviousRouteInfo | null,
    routeThreadId: string,
  ): Promise<StepsPlanResult> {
    const destination = await this.maps.findPlace(destinationName);
    if (!destination) {
      return {
        replyText: `Couldn't find "${destinationName}" — try a different destination.`,
        distanceMeters: null,
        durationSeconds: null,
        encodedPolyline: null,
        startLabel: null,
        destinationLabel: null,
        routeThreadId: null,
      };
    }
    const destinationPoint: LatLng = { lat: destination.lat, lng: destination.lng };

    const searchTarget = resolveStopSearchTarget(
      requestedTargetSteps,
      nearestOnly,
      previousRoute,
    );
    if (!searchTarget) {
      return {
        replyText: `About how far would you like to walk from the ${category}?`,
        distanceMeters: null,
        durationSeconds: null,
        encodedPolyline: null,
        startLabel: null,
        destinationLabel: destination.displayName,
        routeThreadId: null,
      };
    }

    const best = await this.findBestStop(
      category,
      searchTarget.rankTarget,
      searchTarget.searchRadius,
      destinationPoint,
      { placeId: destination.placeId },
      true,
    );
    if (!best) {
      return {
        replyText: NO_ROUTE_REPLY,
        distanceMeters: null,
        durationSeconds: null,
        encodedPolyline: null,
        startLabel: null,
        destinationLabel: destination.displayName,
        routeThreadId: null,
      };
    }

    return {
      replyText: `Get off at ${best.candidate.displayName} — it's about ${(best.route.distanceMeters / 1000).toFixed(1)}km (~${metersToSteps(best.route.distanceMeters)} steps) to ${destination.displayName} from there, ${formatDuration(best.route.durationSeconds)}.`,
      distanceMeters: best.route.distanceMeters,
      durationSeconds: best.route.durationSeconds,
      encodedPolyline: best.route.encodedPolyline,
      startLabel: best.candidate.displayName,
      destinationLabel: destination.displayName,
      routeThreadId,
    };
  }

  // "Which tram stop is 2.5k steps away from me" — no destination, just a
  // category and a target distance from wherever the walk starts.
  private async recommendStopFromStart(
    category: string,
    startPoint: LatLng,
    startLabel: string,
    requestedTargetSteps: number | null,
    nearestOnly: boolean,
    previousRoute: PreviousRouteInfo | null,
    routeThreadId: string,
  ): Promise<StepsPlanResult> {
    const searchTarget = resolveStopSearchTarget(
      requestedTargetSteps,
      nearestOnly,
      previousRoute,
    );
    if (!searchTarget) {
      return {
        replyText: `About how far away would you like that ${category} to be?`,
        distanceMeters: null,
        durationSeconds: null,
        encodedPolyline: null,
        startLabel,
        destinationLabel: null,
        routeThreadId: null,
      };
    }

    const best = await this.findBestStop(
      category,
      searchTarget.rankTarget,
      searchTarget.searchRadius,
      startPoint,
      { location: { latLng: startPoint } },
      false,
    );
    if (!best) {
      return {
        replyText: NO_ROUTE_REPLY,
        distanceMeters: null,
        durationSeconds: null,
        encodedPolyline: null,
        startLabel,
        destinationLabel: null,
        routeThreadId: null,
      };
    }

    return {
      replyText: `${best.candidate.displayName} is about ${(best.route.distanceMeters / 1000).toFixed(1)}km (~${metersToSteps(best.route.distanceMeters)} steps) from ${startLabel}, ${formatDuration(best.route.durationSeconds)} walk.`,
      distanceMeters: best.route.distanceMeters,
      durationSeconds: best.route.durationSeconds,
      encodedPolyline: best.route.encodedPolyline,
      startLabel,
      destinationLabel: best.candidate.displayName,
      routeThreadId,
    };
  }
}
