import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { NewsClient } from './news.client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// One thin endpoint — the "further reading" search itself has no user
// data or ownership concept (unlike items/chats), so there's nothing here
// beyond "logged in, please" (same guard as everywhere else) and a pass-
// through to NewsClient. NewsResponse.tsx calls this once per new section,
// using the AI's own sectionHeading as the query.
@Controller('tools/news')
@UseGuards(JwtAuthGuard)
export class NewsController {
  constructor(private readonly newsClient: NewsClient) {}

  @Get('articles')
  async getArticles(@Query('q') q: string, @Query('country') country?: string) {
    if (!q || !q.trim()) return { articles: [] };
    return { articles: await this.newsClient.search(q.trim(), country) };
  }
}
