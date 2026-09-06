import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from './chat.entity';
import { Message, MessageRole } from './message.entity';
import { RouterService } from '../router/router.service';
import { OpenAiService } from '../openai/openai.service';

export type ChatResult = { type: 'redirect'; suggestedTool: string } | { type: 'reply'; chat: Chat };

function makeTitle(message: string): string {
  const trimmed = message.trim();
  return trimmed.length > 40 ? `${trimmed.slice(0, 40)}...` : trimmed;
}

@Injectable()
export class ChatsService {
  constructor(
    @InjectRepository(Chat)
    private readonly chatsRepository: Repository<Chat>,
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    private readonly router: RouterService,
    private readonly openai: OpenAiService,
  ) {}

  async createChat(userId: string, toolSlug: string, firstMessage: string): Promise<ChatResult> {
    const routerResult = this.router.check(firstMessage, toolSlug);
    if (routerResult.redirect && routerResult.toolSlug) {
      return { type: 'redirect', suggestedTool: routerResult.toolSlug };
    }

    const replyContent = this.openai.generateReply(toolSlug, firstMessage);
    const chat = this.chatsRepository.create({
      userId,
      toolSlug,
      title: makeTitle(firstMessage),
      lastMessagePreview: makeTitle(firstMessage),
      messages: [
        { role: MessageRole.USER, content: firstMessage },
        { role: MessageRole.ASSISTANT, content: replyContent },
      ],
    });
    const saved = await this.chatsRepository.save(chat);
    return { type: 'reply', chat: saved };
  }

  async addMessage(userId: string, chatId: string, content: string): Promise<ChatResult> {
    const chat = await this.getOwnedChat(userId, chatId);

    const routerResult = this.router.check(content, chat.toolSlug);
    if (routerResult.redirect && routerResult.toolSlug) {
      return { type: 'redirect', suggestedTool: routerResult.toolSlug };
    }

    const replyContent = this.openai.generateReply(chat.toolSlug, content);
    await this.messagesRepository.save([
      this.messagesRepository.create({ chatId: chat.id, role: MessageRole.USER, content }),
      this.messagesRepository.create({ chatId: chat.id, role: MessageRole.ASSISTANT, content: replyContent }),
    ]);
    // Preview reflects what the user asked, not the reply — the reply may
    // be structured (JSON) per tool, but the user's own message is always
    // plain text.
    await this.chatsRepository.update({ id: chat.id }, { lastMessagePreview: makeTitle(content) });

    const updated = await this.getOwnedChat(userId, chatId);
    return { type: 'reply', chat: updated };
  }

  async getOwnedChat(userId: string, chatId: string): Promise<Chat> {
    const chat = await this.chatsRepository.findOne({
      where: { id: chatId, userId },
      relations: ['messages'],
    });
    if (!chat) throw new NotFoundException('Chat not found');
    chat.messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return chat;
  }

  getChatsForTool(userId: string, toolSlug: string): Promise<Chat[]> {
    return this.chatsRepository.find({
      where: { userId, toolSlug },
      order: { updatedAt: 'DESC' },
    });
  }

  getAllChats(userId: string): Promise<Chat[]> {
    return this.chatsRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }
}
