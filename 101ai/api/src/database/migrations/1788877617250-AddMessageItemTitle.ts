import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageItemTitle1788877617250 implements MigrationInterface {
  name = 'AddMessageItemTitle1788877617250';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "item_title" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "item_title"`,
    );
  }
}
