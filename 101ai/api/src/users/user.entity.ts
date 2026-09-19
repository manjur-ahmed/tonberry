import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum UserPlan {
  BASIC = 'basic',
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
  // sends a signed-in user with neither a plan nor an active trial (see
  // trialStartedAt) to the pricing page before any tool.
  @Column({ type: 'enum', enum: UserPlan, nullable: true })
  plan: UserPlan | null;

  // Set once, the first time the user taps "Continue with free trial" on
  // /pricing (see UsersService.startTrial) — an alternative to picking a
  // real plan there, not a plan itself: `plan` stays null throughout, so
  // every existing `getPlan(user.plan) ?? plans[0]` fallback already
  // treats a trialing user as Basic-tier for display purposes with no
  // extra logic needed. 14 days is currently just the number shown next to
  // the trial button — nothing reads this column to actually expire or
  // block access once it's passed (deliberately not built yet).
  @Column({ name: 'trial_started_at', type: 'timestamp', nullable: true })
  trialStartedAt: Date | null;

  // ISO 3166-1 alpha-2 code. Null until set on /country (now the preferences
  // page) — that's the gate that sends a signed-in user with no country
  // there before pricing.
  @Column({ type: 'varchar', length: 2, nullable: true })
  country: string | null;

  @Column({ name: 'dark_theme', type: 'boolean', default: false })
  darkTheme: boolean;

  // Collected on /country alongside name/country — 'date' (not timestamp),
  // stored as a plain YYYY-MM-DD string since a birth date has no
  // meaningful time-of-day or timezone component.
  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: string | null;

  // Null for an account that's only ever signed in via Google — set on
  // /settings/password, which is what lets that same account also sign in
  // with email + password (e.g. from a device Google's OAuth redirect
  // can't reach, like over a LAN IP during local testing).
  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
