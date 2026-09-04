import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum UserPlan {
  FREE = 'free',
  PLUS = 'plus',
  PREMIUM = 'premium',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  // Set on first Google sign-in (Phase 2).
  @Column({ name: 'google_id', type: 'varchar', unique: true, nullable: true })
  googleId: string | null;

  // Null until the user picks a plan on /pricing — that's the gate that
  // sends a signed-in user with no plan to the pricing page before any tool.
  @Column({ type: 'enum', enum: UserPlan, nullable: true })
  plan: UserPlan | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
