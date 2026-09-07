import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Message } from './message.entity';

@Entity('chats')
export class Chat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  // Not a foreign key to the tool catalog — tools live in code
  // (tool-catalog.ts), not the database.
  @Column({ name: 'tool_slug' })
  toolSlug: string;

  @Column()
  title: string;

  // Plain-text summary of the latest reply, for list rows — kept separate
  // from Message.content since that can be structured (JSON) per tool.
  @Column({ name: 'last_message_preview', type: 'varchar', nullable: true })
  lastMessagePreview: string | null;

  @OneToMany(() => Message, (message) => message.chat, { cascade: true })
  messages: Message[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
