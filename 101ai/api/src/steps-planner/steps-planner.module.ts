import { Module } from '@nestjs/common';
import { StepsPlannerService } from './steps-planner.service';
import { GoogleMapsClient } from './google-maps.client';
import { OpenAiModule } from '../openai/openai.module';

@Module({
  imports: [OpenAiModule],
  providers: [StepsPlannerService, GoogleMapsClient],
  exports: [StepsPlannerService],
})
export class StepsPlannerModule {}
