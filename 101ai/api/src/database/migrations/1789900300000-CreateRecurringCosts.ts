import { MigrationInterface, QueryRunner } from 'typeorm';

// Hand-written, not CLI-generated — same reasoning as every other migration
// in this file (see git history): the generator picks up unrelated
// pre-existing drift on this dev DB alongside the real intended change.
export class CreateRecurringCosts1789900300000 implements MigrationInterface {
  name = 'CreateRecurringCosts1789900300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."recurring_costs_billing_cycle_enum" AS ENUM('monthly', 'yearly', 'one_time')`,
    );
    await queryRunner.query(`
      CREATE TABLE "recurring_costs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "category" character varying,
        "amount_usd" numeric(12,2) NOT NULL,
        "billing_cycle" "public"."recurring_costs_billing_cycle_enum" NOT NULL DEFAULT 'monthly',
        "renews_at" date,
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recurring_costs_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "recurring_costs"`);
    await queryRunner.query(
      `DROP TYPE "public"."recurring_costs_billing_cycle_enum"`,
    );
  }
}
