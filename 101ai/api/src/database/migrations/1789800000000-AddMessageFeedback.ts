import { MigrationInterface, QueryRunner } from 'typeorm';

// The user's thumbs up/down reaction on an assistant reply (see
// ChatsService.setMessageFeedback) — previously local UI state only,
// discarded on remount.
export class AddMessageFeedback1789800000000 implements MigrationInterface {
  name = 'AddMessageFeedback1789800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "feedback" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "feedback"`,
    );
  }
}
