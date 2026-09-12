import { Module } from '@nestjs/common';
import { OpenAiService } from './openai.service';
import { OpenAiController } from './openai.controller';
import { UsageLogsModule } from '../usage-logs/usage-logs.module';

@Module({
  imports: [UsageLogsModule],
  controllers: [OpenAiController],
  providers: [OpenAiService],
  exports: [OpenAiService],
})
export class OpenAiModule {}
