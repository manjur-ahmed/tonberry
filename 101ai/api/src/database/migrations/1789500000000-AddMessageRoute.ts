import { MigrationInterface, QueryRunner } from 'typeorm';

// Real walking-route data for a Steps Planner assistant reply (see
// StepsPlannerService/ChatsService) — set directly from Google's Routes API
// response, never authored by the model, same "real data, not AI prose"
// pattern as News's newsArticles/newsQuery columns.
export class AddMessageRoute1789500000000 implements MigrationInterface {
  name = 'AddMessageRoute1789500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "route_distance_meters" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "route_duration_seconds" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "route_encoded_polyline" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "route_start_label" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "route_destination_label" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "route_destination_label"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "route_start_label"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "route_encoded_polyline"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "route_duration_seconds"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "route_distance_meters"`,
    );
  }
}
