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

// RouterService stays a plain provider here — still a stub. OpenAiService
// graduated to its own module once it grew real config (an API key/client).
// ItemsModule is imported (not re-exported) purely so ChatsService can look
// up a saved item when starting a chat from it (createChatFromItem).
// UploadsModule likewise, purely for turning an attachment's stored S3 key
// into a fresh presigned view URL (see ChatsService).
@Module({
  imports: [
    TypeOrmModule.forFeature([Chat, Message]),
    OpenAiModule,
    ItemsModule,
    UploadsModule,
  ],
  controllers: [ChatsController],
  providers: [ChatsService, RouterService],
})
export class ChatsModule {}
