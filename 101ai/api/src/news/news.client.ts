import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const LATEST_NEWS_ENDPOINT = 'https://newsdata.io/api/1/latest';

// A real article NewsData.io returned for a "further reading" search (see
// NewsController) — translated from their snake_case wire fields
// (title/link/source_name/pubDate, confirmed against a real response) into
// this app's camelCase convention. Never authored or paraphrased by the
// model — this is what saves onto a News item, and what NewsResponse.tsx
// renders as real, clickable links alongside the AI's own summary.
export interface NewsArticle {
  title: string;
  url: string;
  sourceName: string;
  publishedAt: string;
}

// The model is told to keep searchKeywords short and single-topic (see
// tool-config.ts), but that's not 100% reliable, and qInTitle below ANDs
// every word together — a stray trailing year ("UK politics 2024") or a
// comma-separated list of several topics ("UK politics, Brexit, Rishi
// Sunak") makes an otherwise-good query match almost nothing real.
// Deterministic cleanup as a backend safety net, confirmed empirically
// against the real API to recover a working query from exactly these two
// patterns: keep only the first comma-separated clause, and drop any
// standalone 4-digit year.
function sanitizeKeywords(raw: string): string {
  const firstClause = raw.split(',')[0] ?? raw;
  return firstClause
    .split(/\s+/)
    .filter((word) => !/^\d{4}$/.test(word))
    .join(' ')
    .trim();
}

// Best-effort, same philosophy as GoogleMapsClient — a live external API
// can fail, and that should just mean "no further-reading links this time"
// (NewsResponse.tsx already treats an empty list as nothing to show),
// never break the chat reply itself, which already came back fine from
// OpenAiService with no dependency on this call succeeding.
@Injectable()
export class NewsClient {
  private readonly logger = new Logger(NewsClient.name);
  private readonly apiKey: string | undefined;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('NEWSDATA_API_KEY');
  }

  // `countryCode` is an ISO 3166-1 alpha-2 code (User.country's own
  // format, e.g. "GB") — lowercased for NewsData.io's own `country` param.
  async search(
    keywords: string,
    countryCode?: string | null,
  ): Promise<NewsArticle[]> {
    if (!this.apiKey) return [];
    const cleaned = sanitizeKeywords(keywords).slice(0, 100);
    if (!cleaned) return [];
    try {
      const url = new URL(LATEST_NEWS_ENDPOINT);
      url.searchParams.set('apikey', this.apiKey);
      // qInTitle (title-only match), NOT q (matches anywhere in the
      // article) — confirmed empirically against the real API: q's broad
      // matching pulled in mostly unrelated results (an unrelated op-ed,
      // a university course listing, foreign news sharing one keyword),
      // while qInTitle on the same topic gave genuinely on-topic real
      // headlines. The tradeoff is qInTitle ANDs every word together, so
      // this only works well with a short, real search phrase — never the
      // full topicTitle/sectionHeading sentence (see tool-config.ts's
      // searchKeywords instruction, and NEWS_SCHEMA). A query that still
      // matches nothing after sanitizing just means no further-reading
      // links this time — deliberately NOT falling back to the broad `q`
      // search here, since that was the exact source of the low-relevance
      // results this whole design change was meant to fix.
      url.searchParams.set('qInTitle', cleaned);
      url.searchParams.set('language', 'en');
      url.searchParams.set('size', '5');
      if (countryCode) {
        url.searchParams.set('country', countryCode.toLowerCase());
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        this.logger.warn(
          `NewsData.io returned ${response.status}: ${(await response.text()).slice(0, 200)}`,
        );
        return [];
      }
      const body = (await response.json()) as {
        status?: string;
        results?: {
          title?: string;
          link?: string;
          source_name?: string;
          pubDate?: string;
        }[];
      };
      if (body.status !== 'success') return [];

      const articles: NewsArticle[] = [];
      for (const result of body.results ?? []) {
        if (!result.title || !result.link) continue;
        articles.push({
          title: result.title,
          url: result.link,
          sourceName: result.source_name ?? 'Unknown source',
          publishedAt: result.pubDate ?? '',
        });
      }
      return articles;
    } catch (error) {
      this.logger.warn(
        `NewsData.io request failed: ${(error as Error).message}`,
      );
      return [];
    }
  }
}
