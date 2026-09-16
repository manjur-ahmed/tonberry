import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SEARCH_ENDPOINT = 'https://www.googleapis.com/books/v1/volumes';

export interface GoogleBooksImage {
  url: string;
  source: 'Google Books';
}

// Real book/comic cover art for Read Recommendations (books and, as the
// fallback, Western comics — manga/manhwa/light novels go through
// AniListClient instead) — never a URL the model invents.
//
// Reuses the existing GOOGLE_API_KEY (see GoogleMapsClient) rather than a
// dedicated key — confirmed against the real API that going fully keyless
// doesn't actually work here: this environment's anonymous/unauthenticated
// quota came back as 0 (a shared-IP-pool exhaustion, not a doc-stated
// limit), so a real key genuinely is required despite Google's own docs
// calling it "optional". Needs two one-time Google Cloud Console steps on
// the existing project (same category as the Geocoding API step done
// earlier this session): enable "Books API" for the project, and add
// "Books API" to this key's own API restriction allow-list. Best-effort
// either way — returns null (no image, not an error) until that's done or
// if the key is missing.
@Injectable()
export class GoogleBooksClient {
  private readonly logger = new Logger(GoogleBooksClient.name);
  private readonly apiKey: string | undefined;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('GOOGLE_API_KEY');
  }

  async search(title: string, author: string | null): Promise<GoogleBooksImage | null> {
    if (!this.apiKey) return null;
    const cleaned = title.trim();
    if (!cleaned) return null;
    try {
      const url = new URL(SEARCH_ENDPOINT);
      const query = author ? `intitle:${cleaned} inauthor:${author}` : `intitle:${cleaned}`;
      url.searchParams.set('q', query);
      url.searchParams.set('maxResults', '1');
      url.searchParams.set('key', this.apiKey);

      const response = await fetch(url.toString());
      if (!response.ok) {
        this.logger.warn(`Google Books returned ${response.status}`);
        return null;
      }
      const body = (await response.json()) as {
        items?: {
          volumeInfo?: { imageLinks?: { thumbnail?: string } };
        }[];
      };
      const thumbnail = body.items?.[0]?.volumeInfo?.imageLinks?.thumbnail;
      return thumbnail ? { url: thumbnail, source: 'Google Books' } : null;
    } catch (error) {
      this.logger.warn(
        `Google Books request failed: ${(error as Error).message}`,
      );
      return null;
    }
  }
}
