import { MigrationInterface, QueryRunner } from 'typeorm';

// Replaces the single-item `attached_item` column (see
// AddMessageAttachedItem) with a `attached_items` array — a message can now
// carry more than one attached item (see ChatsService.resolveAttachedItems),
// same as `attachments` (images) already could. No data migration: this app
// has no real user data yet (see TODO.md), so a clean drop+add is simpler
// than converting each existing single-object row into a one-element array.
export class AddMessageAttachedItems1789200000000
  implements MigrationInterface
{
  name = 'AddMessageAttachedItems1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "attached_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "attached_items" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "attached_items"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "attached_item" jsonb`,
    );
  }
}
