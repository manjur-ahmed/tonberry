import { MigrationInterface, QueryRunner } from "typeorm";

export class AddContactMessages1789746114499 implements MigrationInterface {
    name = 'AddContactMessages1789746114499'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "contact_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "email" character varying NOT NULL, "message" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b74f96eb2edd977ccfba6533293" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "contact_messages"`);
    }

}
