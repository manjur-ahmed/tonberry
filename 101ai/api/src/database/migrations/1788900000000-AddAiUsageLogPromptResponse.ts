import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiUsageLogPromptResponse1788900000000
  implements MigrationInterface
{
  name = 'AddAiUsageLogPromptResponse1788900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Nullable — historical rows predate this, and a failed/placeholder
    // reply (see OpenAiService's PLACEHOLDER_REPLY path) never reaches the
    // record() call at all, so there's nothing to backfill either way.
    await queryRunner.query(
      `ALTER TABLE "ai_usage_logs" ADD "prompt" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_logs" ADD "response" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ai_usage_logs" DROP COLUMN "response"`);
    await queryRunner.query(`ALTER TABLE "ai_usage_logs" DROP COLUMN "prompt"`);
  }
}
