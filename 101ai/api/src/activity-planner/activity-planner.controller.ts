import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GoogleMapsClient } from '../steps-planner/google-maps.client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// One thin endpoint, same shape as NewsController's /articles — real
// Places lookup, no user data or ownership concept of its own, so nothing
// here beyond "logged in, please" (same guard as everywhere else). The
// frontend calls this once per suggested activity (see day-activity/
// ResponseView.tsx), using the AI's own activity title/category as the
// search text — real venues only, never a place the model guessed itself.
@Controller('tools/day-activity')
@UseGuards(JwtAuthGuard)
export class ActivityPlannerController {
  constructor(private readonly maps: GoogleMapsClient) {}

  @Get('venue')
  async getVenue(
    @Query('q') q: string,
    @Query('lat') latParam?: string,
    @Query('lng') lngParam?: string,
  ) {
    if (!q || !q.trim()) return { venue: null };
    const lat = latParam ? Number.parseFloat(latParam) : undefined;
    const lng = lngParam ? Number.parseFloat(lngParam) : undefined;
    const near =
      lat !== undefined && lng !== undefined && !Number.isNaN(lat) && !Number.isNaN(lng)
        ? { lat, lng }
        : undefined;
    const found = await this.maps.findPlace(q.trim(), near);
    if (!found) return { venue: null };
    return {
      venue: {
        placeId: found.placeId,
        displayName: found.displayName,
        lat: found.lat,
        lng: found.lng,
      },
    };
  }
}
