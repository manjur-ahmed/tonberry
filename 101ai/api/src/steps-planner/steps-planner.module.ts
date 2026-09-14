import { Module } from '@nestjs/common';
import { StepsPlannerService } from './steps-planner.service';
import { GoogleMapsClient } from './google-maps.client';
import { OpenAiModule } from '../openai/openai.module';

@Module({
  imports: [OpenAiModule],
  providers: [StepsPlannerService, GoogleMapsClient],
  // GoogleMapsClient exported too — ActivityPlannerModule reuses it
  // (real Places lookups for a suggested activity's venue) rather than a
  // second copy of the same client.
  exports: [StepsPlannerService, GoogleMapsClient],
})
export class StepsPlannerModule {}
