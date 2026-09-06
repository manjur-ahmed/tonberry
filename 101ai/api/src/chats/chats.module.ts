import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chat } from './chat.entity';
import { Message } from './message.entity';
import { ChatsService } from './chats.service';
import { ChatsController } from './chats.controller';
import { RouterService } from '../router/router.service';
import { OpenAiService } from '../openai/openai.service';

// RouterService and OpenAiService are registered here rather than in their
// own modules — they're small stubs today. Split them out once either
// grows real config (an OpenAI API key/client, etc.).
@Module({
  imports: [TypeOrmModule.forFeature([Chat, Message])],
  controllers: [ChatsController],
  providers: [ChatsService, RouterService, OpenAiService],
})
export class ChatsModule {}
