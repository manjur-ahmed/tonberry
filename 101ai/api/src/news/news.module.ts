import { Module } from '@nestjs/common';
import { NewsClient } from './news.client';
import { NewsController } from './news.controller';

@Module({
  controllers: [NewsController],
  providers: [NewsClient],
})
export class NewsModule {}
