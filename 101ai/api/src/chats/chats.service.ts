import { randomUUID } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from './chat.entity';
import { Message, MessageRole } from './message.entity';
import { RouterService } from '../router/router.service';
import { OpenAiService } from '../openai/openai.service';
import { ItemsService } from '../items/items.service';

export type ChatResult =
  { type: 'redirect'; suggestedTool: string } | { type: 'reply'; chat: Chat };

function makeTitle(message: string): string {
  const trimmed = message.trim();
  return trimmed.length > 40 ? `${trimmed.slice(0, 40)}...` : trimmed;
}

// Messages created together (a batch save/cascade insert) can land on the
// exact same @CreateDateColumn value — the DB resolves now() once per
// statement, not once per row. getOwnedChat sorts by createdAt to rebuild
// conversation order (both for display and for the history fed to
// OpenAiService), so a tie there means the actual order is whatever the DB
// happened to return rows in, not necessarily the real sequence. Assigning
// explicit, strictly increasing timestamps up front avoids the tie
// entirely rather than trying to break it after the fact.
function sequentialTimestamps(count: number): Date[] {
  const base = Date.now();
  return Array.from({ length: count }, (_, index) => new Date(base + index));
}

// Canned opener for "Start a chat about this" (see createChatFromItem) —
// no OpenAI call for either of these, so the wording is fixed rather than
// generated.
const START_CHAT_USER_MESSAGE = 'I want to talk about this';
const START_CHAT_ASSISTANT_REPLY = 'Sure, how can I help?';

// Wraps the raw item JSON stored on the isItemCard message (see
// createChatFromItem) with a natural-language preamble before it's sent to
// OpenAI as conversation history — the model otherwise sees an unlabeled
// assistant turn indistinguishable from a real prior reply, which biases it
// toward treating the item as the final word rather than as context to
// build on. Only affects what OpenAI sees; the DB row and anything the
// frontend renders from message.content (e.g. the item card in
// word-helper/ResponseView.tsx) are untouched. Generic on purpose —
// createChatFromItem itself is tool-agnostic, so any tool-specific
// interpretation belongs in that tool's `task` string in tool-config.ts,
// not here.
const ITEM_CONTEXT_PREAMBLE =
  'For reference, here is an item the user previously saved and is now ' +
  'viewing (raw data below). Treat it as context already established in ' +
  "this conversation, the same as anything discussed earlier — the " +
  "user's next message may continue about it, or may ask for something " +
  'new or different.';

function wrapItemCardContent(rawContent: string): string {
  return `${ITEM_CONTEXT_PREAMBLE}\n\n${rawContent}`;
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
    private readonly items: ItemsService,
  ) {}

  async createChat(
    userId: string,
    toolSlug: string,
    firstMessage: string,
    skipRouter = false,
  ): Promise<ChatResult> {
    const routerResult = skipRouter
      ? { redirect: false }
      : this.router.check(firstMessage, toolSlug);
    if (routerResult.redirect && routerResult.toolSlug) {
      return { type: 'redirect', suggestedTool: routerResult.toolSlug };
    }

    // Generated upfront (rather than left to the DB) so OpenAiService can
    // log usage against the real chat/message ids even though the chat
    // itself isn't saved until the reply is already back.
    const chatId = randomUUID();
    const assistantMessageId = randomUUID();
    const replyContent = await this.openai.generateReply({
      toolSlug,
      message: firstMessage,
      history: [],
      userId,
      chatId,
      messageId: assistantMessageId,
    });
    const [userTimestamp, assistantTimestamp] = sequentialTimestamps(2);
    const chat = this.chatsRepository.create({
      id: chatId,
      userId,
      toolSlug,
      title: makeTitle(firstMessage),
      lastMessagePreview: makeTitle(firstMessage),
      messages: [
        {
          role: MessageRole.USER,
          content: firstMessage,
          createdAt: userTimestamp,
        },
        {
          id: assistantMessageId,
          role: MessageRole.ASSISTANT,
          content: replyContent,
          createdAt: assistantTimestamp,
        },
      ],
    });
    const saved = await this.chatsRepository.save(chat);
    return { type: 'reply', chat: saved };
  }

  // No OpenAiService call — the item card plus the two canned messages are
  // fixed, not generated. Real context only kicks in once the user sends
  // their own first message, via addMessage's history above.
  async createChatFromItem(
    userId: string,
    itemId: string,
  ): Promise<ChatResult> {
    const item = await this.items.getOwnedItem(userId, itemId);

    const [cardTimestamp, userTimestamp, replyTimestamp] =
      sequentialTimestamps(3);
    const chat = this.chatsRepository.create({
      userId,
      toolSlug: item.toolSlug,
      title: makeTitle(item.title),
      lastMessagePreview: makeTitle(START_CHAT_USER_MESSAGE),
      messages: [
        {
          role: MessageRole.ASSISTANT,
          content: JSON.stringify(item.data),
          createdAt: cardTimestamp,
          isItemCard: true,
        },
        {
          role: MessageRole.USER,
          content: START_CHAT_USER_MESSAGE,
          createdAt: userTimestamp,
        },
        {
          role: MessageRole.ASSISTANT,
          content: START_CHAT_ASSISTANT_REPLY,
          createdAt: replyTimestamp,
        },
      ],
    });
    const saved = await this.chatsRepository.save(chat);
    return { type: 'reply', chat: saved };
  }

  async addMessage(
    userId: string,
    chatId: string,
    content: string,
    skipRouter = false,
  ): Promise<ChatResult> {
    const chat = await this.getOwnedChat(userId, chatId);

    const routerResult = skipRouter
      ? { redirect: false }
      : this.router.check(content, chat.toolSlug);
    if (routerResult.redirect && routerResult.toolSlug) {
      return { type: 'redirect', suggestedTool: routerResult.toolSlug };
    }

    const assistantMessageId = randomUUID();
    const replyContent = await this.openai.generateReply({
      toolSlug: chat.toolSlug,
      message: content,
      history: chat.messages.map((message) => ({
        role: message.role,
        content: message.isItemCard
          ? wrapItemCardContent(message.content)
          : message.content,
      })),
      userId,
      chatId: chat.id,
      messageId: assistantMessageId,
    });
    const [userTimestamp, assistantTimestamp] = sequentialTimestamps(2);
    await this.messagesRepository.save([
      this.messagesRepository.create({
        chatId: chat.id,
        role: MessageRole.USER,
        content,
        createdAt: userTimestamp,
      }),
      this.messagesRepository.create({
        id: assistantMessageId,
        chatId: chat.id,
        role: MessageRole.ASSISTANT,
        content: replyContent,
        createdAt: assistantTimestamp,
      }),
    ]);
    // Preview reflects what the user asked, not the reply — the reply may
    // be structured (JSON) per tool, but the user's own message is always
    // plain text.
    await this.chatsRepository.update(
      { id: chat.id },
      { lastMessagePreview: makeTitle(content) },
    );

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
