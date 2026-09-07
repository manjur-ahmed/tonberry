import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiUsageLogs1788546900000 implements MigrationInterface {
  name = 'AddAiUsageLogs1788546900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // No FK on chat_id/message_id, deliberately — same as user_id
    // elsewhere in this app. The usage log is written as soon as the
    // OpenAI reply comes back, before the chat/message it belongs to is
    // saved (their ids are generated upfront specifically so the log can
    // reference them), so a FK would reject the very first message of
    // every chat. Plain informational columns also suit an audit trail
    // better anyway — the cost record keeps its original ids forever,
    // never nulled out by a cascade.
    await queryRunner.query(
      `CREATE TABLE "ai_usage_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "chat_id" uuid, "message_id" uuid, "tool_slug" character varying NOT NULL, "model" character varying NOT NULL, "prompt_tokens" integer NOT NULL, "completion_tokens" integer NOT NULL, "total_tokens" integer NOT NULL, "cached_tokens" integer NOT NULL DEFAULT 0, "cost_usd" numeric(12,8) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ai_usage_logs_id" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ai_usage_logs"`);
  }
}
