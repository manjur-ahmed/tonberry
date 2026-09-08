import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageItemToolSlug1788879227746
  implements MigrationInterface
{
  name = 'AddMessageItemToolSlug1788879227746';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "item_tool_slug" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "item_tool_slug"`,
    );
  }
}
