import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chat } from './chat.entity';
import { Message } from './message.entity';
import { ChatsService } from './chats.service';
import { ChatsController } from './chats.controller';
import { RouterService } from '../router/router.service';
import { OpenAiModule } from '../openai/openai.module';
import { ItemsModule } from '../items/items.module';
import { UploadsModule } from '../uploads/uploads.module';
import { StepsPlannerModule } from '../steps-planner/steps-planner.module';
import { ShoppingModule } from '../shopping/shopping.module';

// RouterService stays a plain provider here — still a stub. OpenAiService
// graduated to its own module once it grew real config (an API key/client).
// ItemsModule is imported (not re-exported) purely so ChatsService can look
// up a saved item when starting a chat from it (createChatFromItem).
// UploadsModule likewise, purely for turning an attachment's stored S3 key
// into a fresh presigned view URL (see ChatsService). StepsPlannerModule/
// ShoppingModule likewise, purely so ChatsService can hand off to each
// tool's own real-data pipeline instead of OpenAiService.generateReply
// (see steps-planner/shopping handling in ChatsService). News was a
// live-search tool built this way too (GDELT-backed) but was reverted —
// News is a plain generateReply tool again like everything else, see
// project memory for why.
@Module({
  imports: [
    TypeOrmModule.forFeature([Chat, Message]),
    OpenAiModule,
    ItemsModule,
    UploadsModule,
    StepsPlannerModule,
    ShoppingModule,
  ],
  controllers: [ChatsController],
  providers: [ChatsService, RouterService],
})
export class ChatsModule {}
