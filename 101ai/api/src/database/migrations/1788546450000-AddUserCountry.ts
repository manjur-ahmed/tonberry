import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserCountry1788546450000 implements MigrationInterface {
    name = 'AddUserCountry1788546450000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "country" character varying(2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "country"`);
    }
}
