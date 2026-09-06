import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { AddMessageDto } from './dto/add-message.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/user.entity';

@Controller()
@UseGuards(JwtAuthGuard)
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Post('tools/:slug/chats')
  createChat(@CurrentUser() user: User, @Param('slug') slug: string, @Body() dto: CreateChatDto) {
    return this.chatsService.createChat(user.id, slug, dto.message);
  }

  @Post('chats/:chatId/messages')
  addMessage(@CurrentUser() user: User, @Param('chatId') chatId: string, @Body() dto: AddMessageDto) {
    return this.chatsService.addMessage(user.id, chatId, dto.content);
  }

  @Get('chats/:chatId')
  getChat(@CurrentUser() user: User, @Param('chatId') chatId: string) {
    return this.chatsService.getOwnedChat(user.id, chatId);
  }

  @Get('tools/:slug/chats')
  getChatsForTool(@CurrentUser() user: User, @Param('slug') slug: string) {
    return this.chatsService.getChatsForTool(user.id, slug);
  }

  @Get('chats')
  getAllChats(@CurrentUser() user: User) {
    return this.chatsService.getAllChats(user.id);
  }
}
