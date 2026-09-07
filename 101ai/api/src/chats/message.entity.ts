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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
