import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { WikipediaClient } from './wikipedia.client';
import { GoogleBooksClient } from './google-books.client';
import { AniListClient } from './anilist.client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// Real poster/cover art for the recommendation tools (Film, Show, Read) —
// same shape as YoutubeController/NewsController: no user data or
// ownership concept, just "logged in, please" and a pass-through to the
// relevant client. Each ResponseView calls the matching endpoint once per
// new recommendation, using the AI's own title/year/author fields as the
// search — never a URL the model itself produced.
@Controller('tools/images')
@UseGuards(JwtAuthGuard)
export class ImagesController {
  constructor(
    private readonly wikipediaClient: WikipediaClient,
    private readonly googleBooksClient: GoogleBooksClient,
    private readonly aniListClient: AniListClient,
  ) {}

  @Get('movie')
  async movie(@Query('title') title: string, @Query('year') year?: string) {
    if (!title?.trim()) return { image: null };
    return { image: await this.wikipediaClient.searchMovie(title.trim(), year?.trim() || null) };
  }

  @Get('show')
  async show(@Query('title') title: string, @Query('year') year?: string) {
    if (!title?.trim()) return { image: null };
    return { image: await this.wikipediaClient.searchShow(title.trim(), year?.trim() || null) };
  }

  @Get('book')
  async book(@Query('title') title: string, @Query('author') author?: string) {
    if (!title?.trim()) return { image: null };
    return { image: await this.googleBooksClient.search(title.trim(), author?.trim() || null) };
  }

  @Get('manga')
  async manga(@Query('title') title: string) {
    if (!title?.trim()) return { image: null };
    return { image: await this.aniListClient.searchManga(title.trim()) };
  }
}
