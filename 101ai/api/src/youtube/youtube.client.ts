import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SEARCH_ENDPOINT = 'https://www.googleapis.com/youtube/v3/search';

// A real video the YouTube Data API returned for a search — never authored
// or paraphrased by the model (see tool-config.ts's videoKeywords fields).
// The model only ever produces a short search phrase; this is what actually
// resolves to a real, playable video, the same "never trust the model for a
// URL" principle already applied to Quote Finder's search-link and News's
// searchKeywords (see NewsClient).
export interface YoutubeVideo {
  videoId: string;
  title: string;
  channelTitle: string;
}

// Best-effort, same philosophy as NewsClient/GoogleMapsClient — a live
// external API can fail, and that should just mean "no video this time",
// never break the chat reply itself, which already came back fine from
// OpenAiService with no dependency on this call succeeding.
@Injectable()
export class YoutubeClient {
  private readonly logger = new Logger(YoutubeClient.name);
  private readonly apiKey: string | undefined;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('YOUTUBE_API_KEY');
  }

  async search(query: string): Promise<YoutubeVideo | null> {
    if (!this.apiKey) return null;
    const cleaned = query.trim().slice(0, 100);
    if (!cleaned) return null;
    try {
      const url = new URL(SEARCH_ENDPOINT);
      url.searchParams.set('key', this.apiKey);
      url.searchParams.set('q', cleaned);
      url.searchParams.set('part', 'snippet');
      url.searchParams.set('type', 'video');
      url.searchParams.set('maxResults', '1');
      url.searchParams.set('safeSearch', 'strict');

      const response = await fetch(url.toString());
      if (!response.ok) {
        this.logger.warn(
          `YouTube Data API returned ${response.status}: ${(await response.text()).slice(0, 200)}`,
        );
        return null;
      }
      const body = (await response.json()) as {
        items?: {
          id?: { videoId?: string };
          snippet?: { title?: string; channelTitle?: string };
        }[];
      };
      const item = body.items?.[0];
      const videoId = item?.id?.videoId;
      if (!videoId) return null;

      return {
        videoId,
        title: item?.snippet?.title ?? '',
        channelTitle: item?.snippet?.channelTitle ?? '',
      };
    } catch (error) {
      this.logger.warn(
        `YouTube Data API request failed: ${(error as Error).message}`,
      );
      return null;
    }
  }
}
