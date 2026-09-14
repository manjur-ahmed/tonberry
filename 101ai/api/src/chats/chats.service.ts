import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from './chat.entity';
import {
  AttachedItem,
  Message,
  MessageAttachment,
  MessageRole,
} from './message.entity';
import { RouterService } from '../router/router.service';
import { OpenAiService } from '../openai/openai.service';
import { ItemsService } from '../items/items.service';
import { UploadsService } from '../uploads/uploads.service';
import {
  PreviousRouteInfo,
  StepsPlannerService,
} from '../steps-planner/steps-planner.service';
import {
  PreviousProductInfo,
  ShoppingService,
} from '../shopping/shopping.service';
import { getToolCatalogEntry } from '../tools/tool-catalog';

interface GpsLocation {
  lat: number;
  lng: number;
}

// Tools that all hand off to the SAME real-product-search pipeline
// (ShoppingService) — the mechanism (confirm the product, real SerpApi
// search, "change it to X" refinement, one saved item per product) is
// genuinely identical between them, just a different entry point/branding,
// so there's one shared implementation rather than a parallel one per
// tool. Add a new tool here (not a new service) if it's the same kind of
// "find me a real product" request.
const SHOPPING_TOOL_SLUGS = new Set(['shopping', 'clothing']);

export type ChatResult =
  { type: 'redirect'; suggestedTool: string } | { type: 'reply'; chat: Chat };

function makeTitle(message: string): string {
  const trimmed = message.trim();
  return trimmed.length > 40 ? `${trimmed.slice(0, 40)}...` : trimmed;
}

// Messages created together (a batch save/cascade insert) can land on the
// exact same @CreateDateColumn value — the DB resolves now() once per
// statement, not once per row. getOwnedChat sorts by createdAt to rebuild
// conversation order (both for display and for the history fed to
// OpenAiService), so a tie there means the actual order is whatever the DB
// happened to return rows in, not necessarily the real sequence. Assigning
// explicit, strictly increasing timestamps up front avoids the tie
// entirely rather than trying to break it after the fact.
function sequentialTimestamps(count: number): Date[] {
  const base = Date.now();
  return Array.from({ length: count }, (_, index) => new Date(base + index));
}

// Canned opener for "Start a chat about this" (see createChatFromItem) —
// no OpenAI call for either of these, so the wording is fixed rather than
// generated.
const START_CHAT_USER_MESSAGE = 'I want to talk about this';
const START_CHAT_ASSISTANT_REPLY = 'Sure, how can I help?';

// Wraps the raw item JSON stored on the isItemCard message (see
// createChatFromItem) with a natural-language preamble before it's sent to
// OpenAI as conversation history — the model otherwise sees an unlabeled
// assistant turn indistinguishable from a real prior reply, which biases it
// toward treating the item as the final word rather than as context to
// build on. Only affects what OpenAI sees; the DB row and anything the
// frontend renders from message.content (e.g. the item card in
// word-helper/ResponseView.tsx) are untouched. Generic on purpose —
// createChatFromItem itself is tool-agnostic, so any tool-specific
// interpretation belongs in that tool's `task` string in tool-config.ts,
// not here.
const ITEM_CONTEXT_PREAMBLE =
  'For reference, here is an item the user previously saved and is now ' +
  'viewing (raw data below). Treat it as context already established in ' +
  'this conversation, the same as anything discussed earlier — the ' +
  "user's next message may continue about it, or may ask for something " +
  'new or different.';

function wrapItemCardContent(rawContent: string): string {
  return `${ITEM_CONTEXT_PREAMBLE}\n\n${rawContent}`;
}

@Injectable()
export class ChatsService {
  constructor(
    @InjectRepository(Chat)
    private readonly chatsRepository: Repository<Chat>,
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    private readonly router: RouterService,
    private readonly openai: OpenAiService,
    private readonly items: ItemsService,
    private readonly uploads: UploadsService,
    private readonly stepsPlanner: StepsPlannerService,
    private readonly shopping: ShoppingService,
  ) {}

  private isImageAttachment(attachment: MessageAttachment): boolean {
    return attachment.contentType.startsWith('image/');
  }

  // Base64 data: URIs for OpenAiService's vision input, NOT presigned view
  // urls — a presigned url only works if OpenAI's own servers can fetch it,
  // and a local MinIO instance behind localhost can't be reached from
  // anywhere but this machine (confirmed against the real API: it comes
  // back a hard 400 invalid_image_url). Inlining the bytes instead means
  // the model never has to fetch anything, which also makes this robust in
  // prod against S3 network/CORS edge cases, not just a local workaround.
  // Computed from the *incoming* attachments, before anything's saved,
  // since the AI call happens first (see createChat/addMessage). Only
  // image attachments — a PDF/Word/Excel file has no vision equivalent
  // (see describeNonImageAttachments for how those are handled instead).
  // undefined (not an empty array) when there's no image attached, so it
  // can be spread straight into GenerateReplyParams without an extra
  // branch there.
  private async resolveAttachmentsForVision(
    attachments?: MessageAttachment[],
  ): Promise<{ url: string; contentType: string }[] | undefined> {
    const images = (attachments ?? []).filter((attachment) =>
      this.isImageAttachment(attachment),
    );
    if (images.length === 0) return undefined;
    return Promise.all(
      images.map(async (attachment) => ({
        url: await this.uploads.getObjectAsDataUrl(
          attachment.key,
          attachment.contentType,
        ),
        contentType: attachment.contentType,
      })),
    );
  }

  // Documents/spreadsheets (see ALLOWED_UPLOAD_CONTENT_TYPES) have no
  // parsing pipeline here — the model can't see inside them, so the best
  // it gets is knowing, by filename, that they exist, rather than the
  // attachment silently vanishing from its context. undefined when
  // everything attached is an image (or nothing's attached at all).
  private describeNonImageAttachments(
    attachments?: MessageAttachment[],
  ): string | undefined {
    const files = (attachments ?? []).filter(
      (attachment) => !this.isImageAttachment(attachment),
    );
    if (files.length === 0) return undefined;
    const list = files
      .map((file) => `- ${file.filename} (${file.contentType})`)
      .join('\n');
    return (
      "The user also attached the following file(s). You can't see their " +
      'contents — treat this only as knowledge that they exist, and ask ' +
      "the user to paste the relevant text if you need to know what's " +
      `inside:\n${list}`
    );
  }

  // Merges itemContext and the non-image-attachment note into the single
  // itemContext string GenerateReplyParams accepts — same '---'-separated
  // shape buildItemContext already uses for multiple items, so the model
  // reads several distinct pieces of context rather than one blob.
  // undefined when every part is.
  private combineContext(...parts: (string | undefined)[]): string | undefined {
    const nonEmpty = parts.filter((part): part is string => Boolean(part));
    return nonEmpty.length > 0 ? nonEmpty.join('\n\n---\n\n') : undefined;
  }

  // A snapshot of each item at send time (title/data as they are *right
  // now*, not a live reference) — same reasoning as createChatFromItem's
  // own itemTitle/itemToolSlug columns. getOwnedItem also double-checks
  // ownership, so a stray/foreign id 404s here rather than leaking another
  // user's saved item into this message. Returns [] (never null) when
  // itemIds is empty/undefined, so callers can map over it unconditionally.
  private async resolveAttachedItems(
    userId: string,
    itemIds?: string[],
  ): Promise<AttachedItem[]> {
    if (!itemIds || itemIds.length === 0) return [];
    return Promise.all(
      itemIds.map(async (itemId) => {
        const item = await this.items.getOwnedItem(userId, itemId);
        return {
          itemId: item.id,
          toolSlug: item.toolSlug,
          title: item.title,
          data: item.data,
        };
      }),
    );
  }

  // Folds every attached item's full raw data into one itemContext string —
  // each wrapped with the same preamble and separated by a clear divider,
  // so the model reads them as several distinct pieces of context rather
  // than one blob. undefined (not '') when there's nothing attached, so it
  // can be spread straight into GenerateReplyParams without an extra branch
  // at each call site.
  private buildItemContext(attachedItems: AttachedItem[]): string | undefined {
    if (attachedItems.length === 0) return undefined;
    return attachedItems
      .map((item) => wrapItemCardContent(JSON.stringify(item.data)))
      .join('\n\n---\n\n');
  }

  // The last successful route in this chat, if any — lets a follow-up
  // message that names no new place ("shorter", "5k route") continue
  // tweaking that same route instead of StepsPlannerService treating it as
  // an unrelated new request (see PreviousRouteInfo/planRoute).
  private findPreviousRoute(messages: Message[]): PreviousRouteInfo | null {
    for (let i = messages.length - 1; i >= 0; i--) {
      const candidate = messages[i];
      if (
        candidate.role === MessageRole.ASSISTANT &&
        candidate.routeEncodedPolyline &&
        candidate.routeStartLabel &&
        candidate.routeDestinationLabel &&
        candidate.routeDistanceMeters !== null
      ) {
        return {
          threadId: candidate.routeThreadId ?? candidate.id,
          mode:
            candidate.routeStartLabel === candidate.routeDestinationLabel
              ? 'loop'
              : 'point_to_point',
          startLabel: candidate.routeStartLabel,
          destinationLabel: candidate.routeDestinationLabel,
          distanceMeters: candidate.routeDistanceMeters,
        };
      }
    }
    return null;
  }

  // The last real product found in this chat, if any — lets a follow-up
  // like "change it to red" continue updating that same product instead of
  // ShoppingService treating it as an unrelated new search (see
  // PreviousProductInfo/findProduct).
  private findPreviousProduct(messages: Message[]): PreviousProductInfo | null {
    for (let i = messages.length - 1; i >= 0; i--) {
      const candidate = messages[i];
      if (candidate.role === MessageRole.ASSISTANT && candidate.productTitle) {
        return { threadId: candidate.productThreadId ?? candidate.id };
      }
    }
    return null;
  }

  // Enriches already-saved messages with a fresh presigned view url per
  // attachment, in place, for the response the frontend renders a thumbnail
  // from (see Message.attachments' `url` field) — never persisted, computed
  // fresh on every read so display keeps working no matter how old the
  // message is (a stored url would just be a presigned one silently
  // expiring).
  private async resolveMessageAttachments(messages: Message[]): Promise<void> {
    await Promise.all(
      messages.map(async (message) => {
        if (!message.attachments) return;
        message.attachments = await Promise.all(
          message.attachments.map(async (attachment) => ({
            ...attachment,
            url: await this.uploads.getViewUrl(attachment.key),
          })),
        );
      }),
    );
  }

  async createChat(
    userId: string,
    toolSlug: string,
    firstMessage: string,
    skipRouter = false,
    userCountry: string | null = null,
    attachments?: MessageAttachment[],
    itemIds?: string[],
    gpsLocation?: GpsLocation,
  ): Promise<ChatResult> {
    const routerResult = skipRouter
      ? { redirect: false }
      : this.router.check(firstMessage, toolSlug);
    if (routerResult.redirect && routerResult.toolSlug) {
      return { type: 'redirect', suggestedTool: routerResult.toolSlug };
    }

    const attachedItems = await this.resolveAttachedItems(userId, itemIds);

    // Generated upfront (rather than left to the DB) so OpenAiService can
    // log usage against the real chat/message ids even though the chat
    // itself isn't saved until the reply is already back.
    const chatId = randomUUID();
    const assistantMessageId = randomUUID();
    // Steps Planner skips generateReply — a small AI call already happens
    // inside planRoute (intent extraction only), and the reply text it
    // returns is built from the real Routes API result, not written by
    // the model (see StepsPlannerService.planRoute).
    const routeResult =
      toolSlug === 'steps-planner'
        ? await this.stepsPlanner.planRoute(
            firstMessage,
            userId,
            chatId,
            gpsLocation ?? null,
            assistantMessageId,
          )
        : null;
    // Shopping likewise skips generateReply — see routeResult's identical
    // comment.
    const shoppingResult =
      SHOPPING_TOOL_SLUGS.has(toolSlug)
        ? await this.shopping.findProduct(
            firstMessage,
            userId,
            chatId,
            userCountry,
            assistantMessageId,
          )
        : null;
    const replyContent = routeResult
      ? routeResult.replyText
      : shoppingResult
        ? shoppingResult.replyText
        : await this.openai.generateReply({
            toolSlug,
            message: firstMessage,
            history: [],
            userId,
            chatId,
            messageId: assistantMessageId,
            userCountry,
            attachments: await this.resolveAttachmentsForVision(attachments),
            itemContext: this.combineContext(
              this.buildItemContext(attachedItems),
              this.describeNonImageAttachments(attachments),
            ),
          });
    const [userTimestamp, assistantTimestamp] = sequentialTimestamps(2);
    const chat = this.chatsRepository.create({
      id: chatId,
      userId,
      toolSlug,
      title: makeTitle(firstMessage),
      lastMessagePreview: makeTitle(firstMessage),
      messages: [
        {
          role: MessageRole.USER,
          content: firstMessage,
          attachedItems: attachedItems.length > 0 ? attachedItems : null,
          createdAt: userTimestamp,
          attachments: attachments ?? null,
        },
        {
          id: assistantMessageId,
          role: MessageRole.ASSISTANT,
          content: replyContent,
          createdAt: assistantTimestamp,
          routeDistanceMeters: routeResult?.distanceMeters ?? null,
          routeDurationSeconds: routeResult?.durationSeconds ?? null,
          routeEncodedPolyline: routeResult?.encodedPolyline ?? null,
          routeStartLabel: routeResult?.startLabel ?? null,
          routeDestinationLabel: routeResult?.destinationLabel ?? null,
          routeThreadId: routeResult?.routeThreadId ?? null,
          productTitle: shoppingResult?.productTitle ?? null,
          productPrice: shoppingResult?.productPrice ?? null,
          productOldPrice: shoppingResult?.productOldPrice ?? null,
          productThumbnail: shoppingResult?.productThumbnail ?? null,
          productLink: shoppingResult?.productLink ?? null,
          productSource: shoppingResult?.productSource ?? null,
          productRating: shoppingResult?.productRating ?? null,
          productReviews: shoppingResult?.productReviews ?? null,
          productThreadId: shoppingResult?.productThreadId ?? null,
        },
      ],
    });
    const saved = await this.chatsRepository.save(chat);
    await this.resolveMessageAttachments(saved.messages);
    return { type: 'reply', chat: saved };
  }

  // No OpenAiService call — the item card plus the two canned messages are
  // fixed, not generated. Real context only kicks in once the user sends
  // their own first message, via addMessage's history above.
  //
  // targetToolSlug lets an item saved by one tool start a chat in a
  // *different* tool (see ItemDetailModal's "Open in another tool") —
  // defaults to the item's own tool, the original behaviour. The item's raw
  // data still gets sent as-is regardless of which tool the chat lands in;
  // ITEM_CONTEXT_PREAMBLE plus the receiving tool's own scope guard (see
  // tool-config.ts) is what makes a cross-tool item make sense there.
  async createChatFromItem(
    userId: string,
    itemId: string,
    targetToolSlug?: string,
  ): Promise<ChatResult> {
    const item = await this.items.getOwnedItem(userId, itemId);
    if (targetToolSlug && !getToolCatalogEntry(targetToolSlug)) {
      throw new BadRequestException('Unknown tool');
    }
    const toolSlug = targetToolSlug ?? item.toolSlug;

    const [cardTimestamp, userTimestamp, replyTimestamp] =
      sequentialTimestamps(3);
    const chat = this.chatsRepository.create({
      userId,
      toolSlug,
      title: makeTitle(item.title),
      lastMessagePreview: makeTitle(START_CHAT_USER_MESSAGE),
      messages: [
        {
          role: MessageRole.ASSISTANT,
          content: JSON.stringify(item.data),
          createdAt: cardTimestamp,
          isItemCard: true,
          itemTitle: item.title,
          itemToolSlug: item.toolSlug,
        },
        {
          role: MessageRole.USER,
          content: START_CHAT_USER_MESSAGE,
          createdAt: userTimestamp,
        },
        {
          role: MessageRole.ASSISTANT,
          content: START_CHAT_ASSISTANT_REPLY,
          createdAt: replyTimestamp,
        },
      ],
    });
    const saved = await this.chatsRepository.save(chat);
    return { type: 'reply', chat: saved };
  }

  async addMessage(
    userId: string,
    chatId: string,
    content: string,
    skipRouter = false,
    userCountry: string | null = null,
    attachments?: MessageAttachment[],
    itemIds?: string[],
    gpsLocation?: GpsLocation,
  ): Promise<ChatResult> {
    const chat = await this.getOwnedChat(userId, chatId);

    const routerResult = skipRouter
      ? { redirect: false }
      : this.router.check(content, chat.toolSlug);
    if (routerResult.redirect && routerResult.toolSlug) {
      return { type: 'redirect', suggestedTool: routerResult.toolSlug };
    }

    const attachedItems = await this.resolveAttachedItems(userId, itemIds);

    const assistantMessageId = randomUUID();
    // Steps Planner skips generateReply — see createChat's identical
    // comment.
    const routeResult =
      chat.toolSlug === 'steps-planner'
        ? await this.stepsPlanner.planRoute(
            content,
            userId,
            chat.id,
            gpsLocation ?? null,
            assistantMessageId,
            chat.messages.map((message) => ({
              role: message.role,
              content: message.isItemCard
                ? wrapItemCardContent(message.content)
                : message.content,
            })),
            this.findPreviousRoute(chat.messages),
          )
        : null;
    // Shopping likewise skips generateReply — see createChat's identical
    // comment.
    const shoppingResult =
      SHOPPING_TOOL_SLUGS.has(chat.toolSlug)
        ? await this.shopping.findProduct(
            content,
            userId,
            chat.id,
            userCountry,
            assistantMessageId,
            chat.messages.map((message) => ({
              role: message.role,
              content: message.isItemCard
                ? wrapItemCardContent(message.content)
                : message.content,
            })),
            this.findPreviousProduct(chat.messages),
          )
        : null;
    const replyContent = routeResult
      ? routeResult.replyText
      : shoppingResult
        ? shoppingResult.replyText
        : await this.openai.generateReply({
            toolSlug: chat.toolSlug,
            message: content,
            history: chat.messages.map((message) => ({
              role: message.role,
              content: message.isItemCard
                ? wrapItemCardContent(message.content)
                : message.content,
            })),
            userId,
            chatId: chat.id,
            messageId: assistantMessageId,
            userCountry,
            attachments: await this.resolveAttachmentsForVision(attachments),
            itemContext: this.combineContext(
              this.buildItemContext(attachedItems),
              this.describeNonImageAttachments(attachments),
            ),
          });
    const [userTimestamp, assistantTimestamp] = sequentialTimestamps(2);
    await this.messagesRepository.save([
      this.messagesRepository.create({
        chatId: chat.id,
        role: MessageRole.USER,
        content,
        createdAt: userTimestamp,
        attachments: attachments ?? null,
        attachedItems: attachedItems.length > 0 ? attachedItems : null,
      }),
      this.messagesRepository.create({
        id: assistantMessageId,
        chatId: chat.id,
        role: MessageRole.ASSISTANT,
        content: replyContent,
        createdAt: assistantTimestamp,
        routeDistanceMeters: routeResult?.distanceMeters ?? null,
        routeDurationSeconds: routeResult?.durationSeconds ?? null,
        routeEncodedPolyline: routeResult?.encodedPolyline ?? null,
        routeStartLabel: routeResult?.startLabel ?? null,
        routeDestinationLabel: routeResult?.destinationLabel ?? null,
        routeThreadId: routeResult?.routeThreadId ?? null,
        productTitle: shoppingResult?.productTitle ?? null,
        productPrice: shoppingResult?.productPrice ?? null,
        productOldPrice: shoppingResult?.productOldPrice ?? null,
        productThumbnail: shoppingResult?.productThumbnail ?? null,
        productLink: shoppingResult?.productLink ?? null,
        productSource: shoppingResult?.productSource ?? null,
        productRating: shoppingResult?.productRating ?? null,
        productReviews: shoppingResult?.productReviews ?? null,
        productThreadId: shoppingResult?.productThreadId ?? null,
      }),
    ]);
    // Preview reflects what the user asked, not the reply — the reply may
    // be structured (JSON) per tool, but the user's own message is always
    // plain text.
    await this.chatsRepository.update(
      { id: chat.id },
      { lastMessagePreview: makeTitle(content) },
    );

    const updated = await this.getOwnedChat(userId, chatId);
    return { type: 'reply', chat: updated };
  }

  async getOwnedChat(userId: string, chatId: string): Promise<Chat> {
    const chat = await this.chatsRepository.findOne({
      where: { id: chatId, userId },
      relations: ['messages'],
    });
    if (!chat) throw new NotFoundException('Chat not found');
    chat.messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    await this.resolveMessageAttachments(chat.messages);
    return chat;
  }

  getChatsForTool(userId: string, toolSlug: string): Promise<Chat[]> {
    return this.chatsRepository.find({
      where: { userId, toolSlug },
      order: { updatedAt: 'DESC' },
    });
  }

  getAllChats(userId: string): Promise<Chat[]> {
    return this.chatsRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }
}
