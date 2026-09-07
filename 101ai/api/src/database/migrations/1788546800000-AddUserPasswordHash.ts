import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserPasswordHash1788546800000 implements MigrationInterface {
  name = 'AddUserPasswordHash1788546800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "password_hash" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "password_hash"`);
  }
}
