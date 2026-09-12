import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageAttachedItem1789100000000 implements MigrationInterface {
  name = 'AddMessageAttachedItem1789100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Nullable — every existing message predates this. A snapshot of the
    // item at send time (itemId/toolSlug/title/data), not a live reference
    // — same reasoning as the existing isItemCard/itemTitle/itemToolSlug
    // columns: the item could be edited or deleted later, and the message
    // should keep showing what was actually attached when it was sent.
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "attached_item" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "attached_item"`,
    );
  }
}
