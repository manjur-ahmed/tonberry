import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { YoutubeClient } from './youtube.client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// One thin endpoint, same shape as NewsController — no user data or
// ownership concept here, just "logged in, please" and a pass-through to
// YoutubeClient. Every ResponseView that supports video (science-explainer,
// history-helper, politics, tech, home, car, diy) calls this once per new
// section/guide, using the AI's own videoKeywords as the query.
@Controller('tools/youtube')
@UseGuards(JwtAuthGuard)
export class YoutubeController {
  constructor(private readonly youtubeClient: YoutubeClient) {}

  @Get('search')
  async search(@Query('q') q: string) {
    if (!q || !q.trim()) return { video: null };
    return { video: await this.youtubeClient.search(q.trim()) };
  }
}
