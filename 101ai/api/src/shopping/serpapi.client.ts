import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SHOPPING_ENDPOINT = 'https://serpapi.com/search.json';

// A real product SerpApi's Google Shopping engine returned — translated
// from its wire fields (confirmed against a real response) into this
// app's camelCase convention. Never authored or invented by the model —
// this is what gets shown, saved, and linked to.
export interface ShoppingProduct {
  title: string;
  price: string;
  extractedPrice: number | null;
  oldPrice: string | null;
  source: string;
  link: string;
  thumbnail: string;
  rating: number | null;
  reviews: number | null;
}

// Best-effort, same philosophy as GoogleMapsClient/NewsClient — a live
// external API can fail, and that should degrade to "no real results this
// time" (ShoppingService reports that honestly) rather than break the
// whole chat turn.
@Injectable()
export class SerpApiClient {
  private readonly logger = new Logger(SerpApiClient.name);
  private readonly apiKey: string | undefined;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('SERPAPI_KEY');
  }

  // `countryCode` is an ISO 3166-1 alpha-2 code (User.country's own
  // format, e.g. "GB") — lowercased for SerpApi/Google's own `gl` param,
  // which also localizes pricing/currency on its own (confirmed against
  // the real API — a separate currency param isn't needed).
  async search(
    query: string,
    countryCode?: string | null,
  ): Promise<ShoppingProduct[]> {
    if (!this.apiKey || !query.trim()) return [];
    try {
      const url = new URL(SHOPPING_ENDPOINT);
      url.searchParams.set('engine', 'google_shopping');
      url.searchParams.set('q', query.trim());
      url.searchParams.set('hl', 'en');
      if (countryCode) url.searchParams.set('gl', countryCode.toLowerCase());
      url.searchParams.set('api_key', this.apiKey);

      const response = await fetch(url.toString());
      if (!response.ok) {
        this.logger.warn(
          `SerpApi returned ${response.status}: ${(await response.text()).slice(0, 200)}`,
        );
        return [];
      }
      const body = (await response.json()) as {
        search_metadata?: { status?: string };
        error?: string;
        shopping_results?: {
          title?: string;
          price?: string;
          extracted_price?: number;
          old_price?: string;
          source?: string;
          product_link?: string;
          thumbnail?: string;
          rating?: number;
          reviews?: number;
        }[];
      };
      if (body.error || body.search_metadata?.status !== 'Success') {
        if (body.error) this.logger.warn(`SerpApi error: ${body.error}`);
        return [];
      }

      const products: ShoppingProduct[] = [];
      for (const result of body.shopping_results ?? []) {
        if (!result.title || !result.price) continue;
        products.push({
          title: result.title,
          price: result.price,
          extractedPrice: result.extracted_price ?? null,
          oldPrice: result.old_price ?? null,
          source: result.source ?? 'Unknown seller',
          link: result.product_link ?? '',
          thumbnail: result.thumbnail ?? '',
          rating: result.rating ?? null,
          reviews: result.reviews ?? null,
        });
      }
      return products;
    } catch (error) {
      this.logger.warn(`SerpApi request failed: ${(error as Error).message}`);
      return [];
    }
  }
}
