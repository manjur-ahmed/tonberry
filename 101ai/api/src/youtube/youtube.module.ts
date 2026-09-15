import { Module } from '@nestjs/common';
import { YoutubeClient } from './youtube.client';
import { YoutubeController } from './youtube.controller';

@Module({
  controllers: [YoutubeController],
  providers: [YoutubeClient],
})
export class YoutubeModule {}
