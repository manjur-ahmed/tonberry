import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Chat } from './chat.entity';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

@Entity('chat_messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Chat, (chat) => chat.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chat_id' })
  chat: Chat;

  @Column({ name: 'chat_id' })
  chatId: string;

  @Column({ type: 'enum', enum: MessageRole })
  role: MessageRole;

  @Column({ type: 'text' })
  content: string;

  // True only for the item-card message ChatsService.createChatFromItem
  // seeds a chat with — renders as the compact item card (no thumbs/copy,
  // no full definition) instead of going through the tool's normal
  // ResponseView like every other message.
  @Column({ name: 'is_item_card', type: 'boolean', default: false })
  isItemCard: boolean;

  // The saved item's own title (Item.title) at the time this item-card
  // message was created — content only holds the item's raw `data`, which
  // has no single field name for "the display title" that's consistent
  // across every tool's shape (word-helper's `word`, quote-finder's `text`,
  // ...), so it has to be captured here rather than derived from content on
  // read. Null for any non-item-card message, and for an item-card message
  // saved before this column existed (the frontend falls back to the
  // chat's tool name for those, same as it did before this existed).
  @Column({ name: 'item_title', type: 'varchar', nullable: true })
  itemTitle: string | null;

  // The item's own tool (Item.toolSlug), which — since "open in another
  // tool" (see ChatsService.createChatFromItem) — is not necessarily the
  // same as this message's own chat.toolSlug. The frontend needs this to
  // pick the *item's* ItemView (e.g. a film item still renders with its
  // title+year card even sitting inside a Story Explainer chat) rather
  // than the current tool's, which may not know how to display it at all.
  // Null for any non-item-card message, and for an item-card message saved
  // before this column existed (the frontend falls back to the chat's own
  // tool for those, same as it did before this existed).
  @Column({ name: 'item_tool_slug', type: 'varchar', nullable: true })
  itemToolSlug: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
