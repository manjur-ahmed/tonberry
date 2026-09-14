import { Module } from '@nestjs/common';
import { ShoppingService } from './shopping.service';
import { SerpApiClient } from './serpapi.client';
import { OpenAiModule } from '../openai/openai.module';

@Module({
  imports: [OpenAiModule],
  providers: [ShoppingService, SerpApiClient],
  exports: [ShoppingService],
})
export class ShoppingModule {}
