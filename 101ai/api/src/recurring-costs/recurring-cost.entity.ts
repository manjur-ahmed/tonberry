import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum BillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  ONE_TIME = 'one_time',
}

// A manually-maintained ledger of everything paid for to run/build the app
// (domain, hosting, third-party APIs, tooling subscriptions) — nothing here
// is derived from a real billing API, it's whatever an admin has entered via
// AdminCosts.tsx. Distinct from ai_usage_logs (real, per-call OpenAI spend,
// tracked automatically) — this is the OTHER kind of recurring cost, the
// stuff that renews regardless of usage.
@Entity('recurring_costs')
export class RecurringCost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  category: string | null;

  @Column({ name: 'amount_usd', type: 'numeric', precision: 12, scale: 2 })
  amountUsd: string;

  @Column({
    name: 'billing_cycle',
    type: 'enum',
    enum: BillingCycle,
    default: BillingCycle.MONTHLY,
  })
  billingCycle: BillingCycle;

  // Null for a one-time cost that's already been paid and will never renew.
  @Column({ name: 'renews_at', type: 'date', nullable: true })
  renewsAt: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
