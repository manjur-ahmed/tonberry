import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// One row per real OpenAI call — the raw material for the cost-reporting
// queries in usage-reports.controller.ts. chatId/messageId are plain,
// unenforced uuid columns (no FK — same as userId elsewhere in this app):
// the log is written as soon as the reply comes back, before the chat/
// message it belongs to is saved, and a FK would reject every chat's
// first message. Nullable defensively, though nothing sets them null.
@Entity('ai_usage_logs')
export class UsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'chat_id', type: 'uuid', nullable: true })
  chatId: string | null;

  @Column({ name: 'message_id', type: 'uuid', nullable: true })
  messageId: string | null;

  @Column({ name: 'tool_slug' })
  toolSlug: string;

  @Column()
  model: string;

  @Column({ name: 'prompt_tokens', type: 'integer' })
  promptTokens: number;

  @Column({ name: 'completion_tokens', type: 'integer' })
  completionTokens: number;

  @Column({ name: 'total_tokens', type: 'integer' })
  totalTokens: number;

  // Present for future tools with long/cacheable prompts — always 0 today
  // (word-helper's prompt is far too short to trigger OpenAI's automatic
  // prompt caching) and not yet factored into costUsd.
  @Column({ name: 'cached_tokens', type: 'integer', default: 0 })
  cachedTokens: number;

  // Snapshotted at insert time from model-pricing.ts — never recomputed
  // later, so historical costs don't silently shift if pricing changes.
  @Column({ name: 'cost_usd', type: 'numeric', precision: 12, scale: 8 })
  costUsd: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
