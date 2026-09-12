import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { getToolConfig } from '../tools/tool-config';
import { UsageLogsService } from '../usage-logs/usage-logs.service';

// Default worst-case cost guard, used whenever a tool doesn't set its own
// maxCompletionTokens (see tool-config.ts) — comfortably covers the largest
// structured reply across tools today: film/book-recommendations
// enumerating a long real series in full (e.g. two dozen entries for a
// franchise like James Bond), each with a title/year/genre/summary/reason/
// rating. A plain taste-based request only produces 3 entries and uses a
// small fraction of this.
const MAX_COMPLETION_TOKENS = 2500;

// Bounds how much prior conversation gets sent on a long chat — a simple
// recency cutoff, not real pruning/summarization. Plenty for any chat this
// app produces today.
const MAX_HISTORY_MESSAGES = 20;

const PLACEHOLDER_REPLY =
  "This is a placeholder response — real AI replies aren't wired up yet.";

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateReplyParams {
  toolSlug: string;
  message: string;
  // Prior turns in this chat, oldest first, not including `message` itself
  // — without this every reply is stateless regardless of plan (see
  // chats.service.ts callers for where it comes from).
  history: HistoryMessage[];
  userId: string;
  chatId: string;
  messageId: string;
  // The user's own ISO 3166-1 alpha-2 country (User.country) — only
  // actually used by a tool that opts in via usesResidencyContext (see
  // tool-config.ts), e.g. Politics & Law needing to know which country's
  // law a jurisdiction-dependent question means. Null/undefined for a user
  // who hasn't set it yet; getToolConfig just omits the context in that case.
  userCountry?: string | null;
  // Image(s) on this specific turn — presigned, short-lived view URLs
  // already resolved from the stored S3 keys by the caller (see
  // ChatsService), never a raw key. Only ever set on the new user message,
  // not on `history` — a prior turn's own attachments aren't re-sent, same
  // as OpenAI's own multi-turn vision guidance (the model doesn't need to
  // re-see an image it already responded to once).
  attachments?: { url: string; contentType: string }[];
  // A saved item attached to this turn (see ChatsService.resolveAttachedItem),
  // already wrapped with its context preamble by the caller — folded into
  // the same user turn as `message`, not sent as separate history, so the
  // model reads it as "here's what this message is about" rather than a
  // detached prior exchange.
  itemContext?: string;
}

@Injectable()
export class OpenAiService {
  private readonly client: OpenAI;

  constructor(
    config: ConfigService,
    private readonly usageLogs: UsageLogsService,
  ) {
    this.client = new OpenAI({ apiKey: config.get<string>('OPENAI_API_KEY') });
  }

  // Config-driven, not a per-tool branch — any slug with a TOOL_DEFINITIONS
  // entry (see tool-config.ts) gets a real call here, structured
  // (json_schema, strict) if it declares a responseSchema, plain text
  // otherwise. A slug with no entry gets the canned placeholder (and no
  // usage log — there's nothing to log).
  async generateReply(params: GenerateReplyParams): Promise<string> {
    const config = getToolConfig(params.toolSlug, params.userCountry);
    if (!config) return PLACEHOLDER_REPLY;

    try {
      // Plain string when there's nothing attached — only switches to the
      // multi-part content-array form (OpenAI's vision input shape) when
      // this specific turn actually has an image and/or an attached item,
      // so every existing text-only tool's request shape is completely
      // unchanged. itemContext (if any) comes first — it's the thing being
      // referenced, `message` is what the user actually wants done with it.
      const hasAttachments =
        Boolean(params.itemContext) || (params.attachments && params.attachments.length > 0);
      const userContent = hasAttachments
        ? [
            ...(params.itemContext ? [{ type: 'text' as const, text: params.itemContext }] : []),
            { type: 'text' as const, text: params.message },
            ...(params.attachments ?? []).map((attachment) => ({
              type: 'image_url' as const,
              image_url: { url: attachment.url },
            })),
          ]
        : params.message;

      const response = await this.client.chat.completions.create({
        model: config.model,
        messages: [
          { role: 'system', content: config.systemPrompt },
          ...params.history.slice(-MAX_HISTORY_MESSAGES).map((entry) => ({
            role: entry.role,
            content: entry.content,
          })),
          { role: 'user', content: userContent },
        ],
        max_completion_tokens:
          config.maxCompletionTokens ?? MAX_COMPLETION_TOKENS,
        response_format: config.responseSchema
          ? {
              type: 'json_schema',
              json_schema: {
                name: config.responseSchema.name,
                strict: true,
                schema: config.responseSchema.schema,
              },
            }
          : { type: 'text' },
      });
      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response from OpenAI');

      const usage = response.usage;
      if (usage) {
        // config.model (what we requested), not response.model (the
        // specific dated snapshot OpenAI actually served) — MODEL_PRICING
        // is keyed by the request-time name, so this is what actually
        // resolves to a price.
        await this.usageLogs.record({
          userId: params.userId,
          chatId: params.chatId,
          messageId: params.messageId,
          toolSlug: params.toolSlug,
          model: config.model,
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          cachedTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
          prompt: params.message,
          response: content,
        });
      }

      return content;
    } catch {
      throw new InternalServerErrorException(
        'Could not generate a reply — try again.',
      );
    }
  }
}
