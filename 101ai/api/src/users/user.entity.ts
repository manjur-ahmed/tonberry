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

  // First name. Set on first Google sign-in (Phase 2), overwritten by the
  // user's own input on /country (now the preferences page).
  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  // Anything after the first name typed into the preferences page — e.g.
  // "Ada Lovelace Byron" stores "Ada" in `name` and "Lovelace Byron" here.
  @Column({ name: 'other_names', type: 'varchar', nullable: true })
  otherNames: string | null;

  // Set on first Google sign-in (Phase 2).
  @Column({ name: 'google_id', type: 'varchar', unique: true, nullable: true })
  googleId: string | null;

  // Null until the user picks a plan on /pricing — that's the gate that
  // sends a signed-in user with no plan to the pricing page before any tool.
  @Column({ type: 'enum', enum: UserPlan, nullable: true })
  plan: UserPlan | null;

  // ISO 3166-1 alpha-2 code. Null until set on /country (now the preferences
  // page) — that's the gate that sends a signed-in user with no country
  // there before pricing.
  @Column({ type: 'varchar', length: 2, nullable: true })
  country: string | null;

  @Column({ name: 'dark_theme', type: 'boolean', default: false })
  darkTheme: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
