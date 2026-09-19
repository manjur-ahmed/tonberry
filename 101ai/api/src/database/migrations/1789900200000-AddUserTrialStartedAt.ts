import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserTrialStartedAt1789900200000 implements MigrationInterface {
  name = 'AddUserTrialStartedAt1789900200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "trial_started_at" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "trial_started_at"`);
  }
}
