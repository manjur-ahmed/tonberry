import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageIsItemCard1788547000000 implements MigrationInterface {
  name = 'AddMessageIsItemCard1788547000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "is_item_card" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "is_item_card"`,
    );
  }
}
