import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddItemDedupKey1788546600000 implements MigrationInterface {
  name = 'AddItemDedupKey1788546600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "items" ADD "dedup_key" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "items" DROP COLUMN "updated_at"`);
    await queryRunner.query(`ALTER TABLE "items" DROP COLUMN "dedup_key"`);
  }
}
