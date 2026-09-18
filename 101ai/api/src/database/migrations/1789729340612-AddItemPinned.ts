import { MigrationInterface, QueryRunner } from 'typeorm';

// Hand-written, not CLI-generated — migration:generate against the local
// dev DB also picked up unrelated pre-existing drift (user_id column types,
// a differently-named FK on items.chat_id) that has nothing to do with this
// column and shouldn't ship in the same migration. Worth its own
// investigation separately.
export class AddItemPinned1789729340612 implements MigrationInterface {
  name = 'AddItemPinned1789729340612';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "items" ADD "pinned" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "items" DROP COLUMN "pinned"`);
  }
}
