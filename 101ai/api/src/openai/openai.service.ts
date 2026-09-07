import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { getToolConfig } from '../tools/tool-config';
import { UsageLogsService } from '../usage-logs/usage-logs.service';

// Worst-case cost guard — comfortably covers a structured reply (a
// definition plus a few examples/synonyms) on gpt-4o-mini.
const MAX_COMPLETION_TOKENS = 500;

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
    const config = getToolConfig(params.toolSlug);
    if (!config) return PLACEHOLDER_REPLY;

    try {
      const response = await this.client.chat.completions.create({
        model: config.model,
        messages: [
          { role: 'system', content: config.systemPrompt },
          ...params.history.slice(-MAX_HISTORY_MESSAGES).map((entry) => ({
            role: entry.role,
            content: entry.content,
          })),
          { role: 'user', content: params.message },
        ],
        max_completion_tokens: MAX_COMPLETION_TOKENS,
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
