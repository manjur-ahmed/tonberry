import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { AddMessageDto } from './dto/add-message.dto';
import { StartChatFromItemDto } from './dto/start-chat-from-item.dto';
import { SetMessageFeedbackDto } from './dto/set-message-feedback.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/user.entity';

@Controller()
@UseGuards(JwtAuthGuard)
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Post('tools/:slug/chats')
  createChat(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Body() dto: CreateChatDto,
  ) {
    return this.chatsService.createChat(
      user.id,
      slug,
      dto.message,
      dto.skipRouter,
      user.country,
      dto.attachments,
      dto.itemIds,
      dto.gpsLocation,
    );
  }

  @Post('items/:itemId/start-chat')
  startChatFromItem(
    @CurrentUser() user: User,
    @Param('itemId') itemId: string,
    @Body() dto: StartChatFromItemDto,
  ) {
    return this.chatsService.createChatFromItem(
      user.id,
      itemId,
      dto.targetToolSlug,
    );
  }

  @Post('chats/:chatId/messages')
  addMessage(
    @CurrentUser() user: User,
    @Param('chatId') chatId: string,
    @Body() dto: AddMessageDto,
  ) {
    return this.chatsService.addMessage(
      user.id,
      chatId,
      dto.content,
      dto.skipRouter,
      user.country,
      dto.attachments,
      dto.itemIds,
      dto.gpsLocation,
    );
  }

  @Patch('chats/:chatId/messages/:messageId/feedback')
  setMessageFeedback(
    @CurrentUser() user: User,
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
    @Body() dto: SetMessageFeedbackDto,
  ) {
    return this.chatsService.setMessageFeedback(
      user.id,
      chatId,
      messageId,
      dto.feedback,
    );
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

  @Delete('chats/:chatId')
  deleteChat(@CurrentUser() user: User, @Param('chatId') chatId: string) {
    return this.chatsService.deleteChat(user.id, chatId);
  }

  @Delete('chats')
  deleteAllChats(@CurrentUser() user: User) {
    return this.chatsService.deleteAllForUser(user.id);
  }
}
