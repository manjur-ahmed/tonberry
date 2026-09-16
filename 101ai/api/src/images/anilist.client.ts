import { Injectable, Logger } from '@nestjs/common';

const GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';

// type: MANGA on AniList covers manga, manhwa, manhua, and light novels
// all under one unified media type (with its own `format` sub-field
// distinguishing them) — matches this app's Read Recommendations grouping.
const SEARCH_QUERY = `
  query ($search: String) {
    Media(search: $search, type: MANGA) {
      coverImage {
        medium
      }
    }
  }
`;

export interface AniListImage {
  url: string;
  source: 'AniList';
}

// Real manga/manhwa/light-novel cover art for Read Recommendations — never
// a URL the model invents. Keyless public GraphQL endpoint, no signup.
// AniList's own docs site blocked automated fetching while researching this
// (403, bot protection) — built from well-established public knowledge of
// this widely-used API rather than a freshly-confirmed doc page; verify
// the very first real search against this while testing, same as any
// external integration in this codebase.
@Injectable()
export class AniListClient {
  private readonly logger = new Logger(AniListClient.name);

  async searchManga(title: string): Promise<AniListImage | null> {
    const cleaned = title.trim();
    if (!cleaned) return null;
    try {
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query: SEARCH_QUERY,
          variables: { search: cleaned },
        }),
      });
      if (!response.ok) {
        this.logger.warn(`AniList returned ${response.status}`);
        return null;
      }
      const body = (await response.json()) as {
        data?: { Media?: { coverImage?: { medium?: string } } };
      };
      const url = body.data?.Media?.coverImage?.medium;
      return url ? { url, source: 'AniList' } : null;
    } catch (error) {
      this.logger.warn(`AniList request failed: ${(error as Error).message}`);
      return null;
    }
  }
}
