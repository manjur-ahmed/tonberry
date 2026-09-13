import { MigrationInterface, QueryRunner } from 'typeorm';

// Groups messages that belong to the same "tweak this route" conversation
// thread (see StepsPlannerService.planRoute's continuation handling), so
// the frontend can update one saved Item across a whole back-and-forth
// instead of creating a new one per message.
export class AddMessageRouteThreadId1789600000000
  implements MigrationInterface
{
  name = 'AddMessageRouteThreadId1789600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD "route_thread_id" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP COLUMN "route_thread_id"`,
    );
  }
}
