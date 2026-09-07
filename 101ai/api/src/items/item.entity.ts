import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('items')
export class Item {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  // Not a foreign key — tools live in code (tool-catalog.ts), not the database.
  @Column({ name: 'tool_slug' })
  toolSlug: string;

  // Which chat/message this was last saved/updated from, if any. FK
  // enforced at the DB level (see migration) but no ORM relation —
  // nothing here needs to join back to the chat.
  @Column({ name: 'chat_id', type: 'uuid', nullable: true })
  chatId: string | null;

  // Cheap generic label for list views — everything tool-specific lives in `data`.
  @Column()
  title: string;

  @Column({ type: 'jsonb' })
  data: unknown;

  // Opaque per-tool match key (e.g. a lowercased word for Word Helper).
  // Saving with a dedupKey that matches an existing item updates it in
  // place instead of creating a duplicate. Null means "always a new item"
  // — the right default for tools with no natural dedup concept.
  @Column({ name: 'dedup_key', type: 'varchar', nullable: true })
  dedupKey: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
