import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatLastMessagePreview1788546650000 implements MigrationInterface {
  name = 'AddChatLastMessagePreview1788546650000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chats" ADD "last_message_preview" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chats" DROP COLUMN "last_message_preview"`,
    );
  }
}
