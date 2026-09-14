import { Injectable } from '@nestjs/common';
import { HistoryMessage, OpenAiService } from '../openai/openai.service';
import { SerpApiClient } from './serpapi.client';

export interface ShoppingResult {
  replyText: string;
  productTitle: string | null;
  productPrice: string | null;
  productOldPrice: string | null;
  productThumbnail: string | null;
  productLink: string | null;
  productSource: string | null;
  productRating: number | null;
  productReviews: number | null;
  // See planRoute's identical pattern in StepsPlannerService — a stable id
  // shared by every message in the same "tweak this product" thread, so
  // ChatsService can persist it and the frontend can update ONE saved item
  // across a whole back-and-forth ("change it to red") instead of a new
  // item per message.
  productThreadId: string | null;
}

// What ChatsService knows about the last real product found in this chat
// (derived from the last assistant message with one) — lets "change it to
// red" continue updating that same saved item.
export interface PreviousProductInfo {
  threadId: string;
}

const NO_PRODUCT_REPLY =
  "Couldn't find a real product matching that — try describing it differently.";

@Injectable()
export class ShoppingService {
  constructor(
    private readonly openai: OpenAiService,
    private readonly serpApi: SerpApiClient,
  ) {}

  // The one entry point ChatsService calls for a Shopping message. Same
  // shape as StepsPlannerService.planRoute: a small AI call interprets
  // *intent* only (never invents a product itself — see
  // OpenAiService.extractShoppingIntent), a real SerpApi search finds the
  // actual product, and the reply text describing it is built
  // deterministically from those real results, not written by the model.
  async findProduct(
    message: string,
    userId: string,
    chatId: string,
    userCountry: string | null,
    newMessageId: string,
    history: HistoryMessage[] = [],
    previousProduct: PreviousProductInfo | null = null,
  ): Promise<ShoppingResult> {
    const intent = await this.openai.extractShoppingIntent(
      message,
      userId,
      chatId,
      history,
    );

    // No real search runs until the user has actually confirmed what to
    // look for (see SHOPPING_INTENT_SYSTEM_PROMPT) — 'chat' (genuinely
    // vague) and 'confirm' (a specific product named, but not yet agreed
    // to) both leave searchQuery null, so this one check covers both.
    if (intent.kind === 'chat' || !intent.searchQuery) {
      return {
        replyText: intent.reply,
        productTitle: null,
        productPrice: null,
        productOldPrice: null,
        productThumbnail: null,
        productLink: null,
        productSource: null,
        productRating: null,
        productReviews: null,
        productThreadId: null,
      };
    }

    const products = await this.serpApi.search(intent.searchQuery, userCountry);
    const product = products[0];
    if (!product) {
      return {
        replyText: NO_PRODUCT_REPLY,
        productTitle: null,
        productPrice: null,
        productOldPrice: null,
        productThumbnail: null,
        productLink: null,
        productSource: null,
        productRating: null,
        productReviews: null,
        productThreadId: null,
      };
    }

    const productThreadId =
      intent.isRefinement && previousProduct
        ? previousProduct.threadId
        : newMessageId;

    const priceLine = product.oldPrice
      ? `${product.price} (was ${product.oldPrice})`
      : product.price;
    const ratingLine =
      product.rating && product.reviews
        ? `, rated ${product.rating}★ (${product.reviews} reviews)`
        : '';
    const replyText = `Found: ${product.title} — ${priceLine} from ${product.source}${ratingLine}.`;

    return {
      replyText,
      productTitle: product.title,
      productPrice: product.price,
      productOldPrice: product.oldPrice,
      productThumbnail: product.thumbnail,
      productLink: product.link,
      productSource: product.source,
      productRating: product.rating,
      productReviews: product.reviews,
      productThreadId,
    };
  }
}
