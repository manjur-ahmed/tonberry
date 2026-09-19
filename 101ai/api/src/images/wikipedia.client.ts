import { Injectable, Logger } from '@nestjs/common';

const SEARCH_ENDPOINT = 'https://en.wikipedia.org/w/api.php';
const SUMMARY_ENDPOINT = 'https://en.wikipedia.org/api/rest_v1/page/summary/';

// Wikipedia requires a real, descriptive User-Agent identifying the
// application per their API etiquette — requests without one can be
// rejected. Not a secret, just identification.
const USER_AGENT = '101ai/1.0 (https://101ai.tonberry.co.uk)';

export interface WikipediaImage {
  url: string;
  source: 'Wikipedia';
}

// Real film/TV poster art for Film Recommendations/Show Recommendations —
// never a URL the model invents (same "never trust the model for a URL"
// principle as YoutubeClient). Two-step, both keyless: (1) search for the
// real, disambiguated page title, since guessing the title directly fails
// for anything ambiguous; (2) fetch that page's summary, whose `thumbnail`
// is reliably the lead infobox image — confirmed against the real API that
// for a film this is the actual poster (e.g. "Inception" resolved to its
// real theatrical poster image, not a generic photo).
//
// A film/TV poster on Wikipedia is typically uploaded under a fair-use
// rationale scoped to illustrating that specific article, not a general
// redistribution license — same real-world caveat that applies to most
// free poster sources (confirmed/discussed with the user before building
// this; accepted trade-off for a free, keyless, no-commercial-tier option).
@Injectable()
export class WikipediaClient {
  private readonly logger = new Logger(WikipediaClient.name);

  async searchMovie(title: string, year: string | null): Promise<WikipediaImage | null> {
    return this.search(title, 'film', year);
  }

  async searchShow(title: string, year: string | null): Promise<WikipediaImage | null> {
    return this.search(title, 'TV series', year);
  }

  private async search(
    title: string,
    disambiguator: string,
    year: string | null,
  ): Promise<WikipediaImage | null> {
    const cleaned = title.trim();
    if (!cleaned) return null;
    try {
      const pageTitle = await this.findPageTitle(cleaned, disambiguator, year);
      if (!pageTitle) return null;
      return await this.fetchThumbnail(pageTitle);
    } catch (error) {
      this.logger.warn(
        `Wikipedia lookup failed for "${cleaned}": ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async findPageTitle(
    title: string,
    disambiguator: string,
    year: string | null,
  ): Promise<string | null> {
    const url = new URL(SEARCH_ENDPOINT);
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'search');
    // The title itself must be quoted as an exact phrase — confirmed
    // against the real API that an unquoted multi-word query (title +
    // disambiguator + year all as loose terms) can rank a tangentially
    // related page above the real one once the year is added (e.g. a plain
    // "Breaking Bad TV series 2008" search returned a franchise character
    // list first, not the show's own page; quoting "Breaking Bad" fixed
    // it while keeping the year for disambiguation power). The year still
    // helps for a genuine remake/same-title case, just needs the title
    // itself protected from being diluted by the other terms.
    url.searchParams.set(
      'srsearch',
      [`"${title}"`, disambiguator, year].filter(Boolean).join(' '),
    );
    url.searchParams.set('format', 'json');
    url.searchParams.set('srlimit', '1');

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!response.ok) {
      this.logger.warn(`Wikipedia search returned ${response.status}`);
      return null;
    }
    const body = (await response.json()) as {
      query?: { search?: { title?: string }[] };
    };
    return body.query?.search?.[0]?.title ?? null;
  }

  private async fetchThumbnail(pageTitle: string): Promise<WikipediaImage | null> {
    const response = await fetch(
      `${SUMMARY_ENDPOINT}${encodeURIComponent(pageTitle)}`,
      { headers: { 'User-Agent': USER_AGENT } },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as {
      thumbnail?: { source?: string };
    };
    const url = body.thumbnail?.source;
    return url ? { url, source: 'Wikipedia' } : null;
  }
}
