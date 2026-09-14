import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// A free-text "recommend a tool" note from Settings — reviewed manually via
// GET /suggestions (see SuggestionsController), no in-app reply flow. email
// is denormalized off User at submit time (not a live join) so the admin
// list still shows who suggested what even if that account is later
// deleted.
@Entity('suggestions')
export class Suggestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'user_email' })
  userEmail: string;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
