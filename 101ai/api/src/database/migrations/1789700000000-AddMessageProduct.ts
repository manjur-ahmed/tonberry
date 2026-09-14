import { MigrationInterface, QueryRunner } from 'typeorm';

// Real product data for a Shopping-tool assistant reply (see
// ShoppingService/ChatsService) — set directly from SerpApi's Google
// Shopping response, never authored by the model, same "real data, not AI
// prose" pattern as News's/Steps Planner's own columns.
export class AddMessageProduct1789700000000 implements MigrationInterface {
  name = 'AddMessageProduct1789700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "product_title" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "product_price" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "product_old_price" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "product_thumbnail" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "product_link" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "product_source" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "product_rating" real`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "product_reviews" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "product_thread_id" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "product_thread_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "product_reviews"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "product_rating"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "product_source"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "product_link"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "product_thumbnail"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "product_old_price"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "product_price"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "product_title"`,
    );
  }
}
