import { MigrationInterface, QueryRunner } from 'typeorm';

// "Recommend a tool" free-text notes submitted from Settings (see
// SuggestionsController) — reviewed manually via GET /suggestions, no
// foreign key to users so a suggestion survives account deletion.
export class AddSuggestions1789900000000 implements MigrationInterface {
  name = 'AddSuggestions1789900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "suggestions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "user_email" varchar NOT NULL,
        "content" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_suggestions_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "suggestions"`);
  }
}
