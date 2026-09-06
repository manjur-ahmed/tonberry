import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserPreferences1788546700000 implements MigrationInterface {
    name = 'AddUserPreferences1788546700000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "other_names" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "dark_theme" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "dark_theme"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "other_names"`);
    }
}
