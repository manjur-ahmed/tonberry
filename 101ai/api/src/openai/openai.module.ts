import { Module } from '@nestjs/common';
import { OpenAiService } from './openai.service';
import { UsageLogsModule } from '../usage-logs/usage-logs.module';

@Module({
  imports: [UsageLogsModule],
  providers: [OpenAiService],
  exports: [OpenAiService],
})
export class OpenAiModule {}
