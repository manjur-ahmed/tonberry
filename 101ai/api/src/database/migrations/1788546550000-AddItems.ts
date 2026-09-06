import { MigrationInterface, QueryRunner } from "typeorm";

export class AddItems1788546550000 implements MigrationInterface {
    name = 'AddItems1788546550000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "tool_slug" character varying NOT NULL, "chat_id" uuid, "title" character varying NOT NULL, "data" jsonb NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_items_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "items" ADD CONSTRAINT "FK_items_chat" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE SET NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "items" DROP CONSTRAINT "FK_items_chat"`);
        await queryRunner.query(`DROP TABLE "items"`);
    }
}
