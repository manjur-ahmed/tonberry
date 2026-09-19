import { MigrationInterface, QueryRunner } from 'typeorm';

// Hand-written, not CLI-generated — same reasoning as AddItemPinned: the
// generator mixes in unrelated pre-existing drift on this DB. RENAME VALUE
// relabels the enum in place rather than dropping/recreating it, so any
// existing row with plan='free' becomes 'basic' automatically, no data
// migration needed on top.
export class RenameFreeToBasicAndAddDateOfBirth1789900100000
  implements MigrationInterface
{
  name = 'RenameFreeToBasicAndAddDateOfBirth1789900100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."users_plan_enum" RENAME VALUE 'free' TO 'basic'`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "date_of_birth" date`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "date_of_birth"`);
    await queryRunner.query(
      `ALTER TYPE "public"."users_plan_enum" RENAME VALUE 'basic' TO 'free'`,
    );
  }
}
