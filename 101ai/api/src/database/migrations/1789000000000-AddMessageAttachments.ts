import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageAttachments1789000000000 implements MigrationInterface {
  name = 'AddMessageAttachments1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Nullable — every existing message predates uploads. Stores the raw S3
    // key only, never a URL (the bucket is private) — see UploadsService
    // for why every URL handed out is a fresh, short-lived presigned one
    // generated on demand rather than something durable stored here.
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "attachments" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "attachments"`,
    );
  }
}
