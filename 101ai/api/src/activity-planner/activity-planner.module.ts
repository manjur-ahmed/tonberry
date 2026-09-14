import { Module } from '@nestjs/common';
import { ActivityPlannerController } from './activity-planner.controller';
import { StepsPlannerModule } from '../steps-planner/steps-planner.module';

@Module({
  imports: [StepsPlannerModule],
  controllers: [ActivityPlannerController],
})
export class ActivityPlannerModule {}
