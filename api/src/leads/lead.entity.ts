import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';

export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  QUALIFIED = 'qualified',
  WON = 'won',
  LOST = 'lost',
}

@Entity('leads')
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Submission fields, from the public hero form (M8).
  @Column()
  name: string;

  @Column()
  email: string;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ name: 'property_type', type: 'varchar', nullable: true })
  propertyType: string | null;

  @Column({ name: 'loan_amount', type: 'numeric', nullable: true })
  loanAmount: string | null;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  // Rule-based score from M11, null until computed.
  @Column({ name: 'priority_score', type: 'float', nullable: true })
  priorityScore: number | null;

  @Column({ type: 'enum', enum: LeadStatus, default: LeadStatus.NEW })
  status: LeadStatus;

  // Null = unassigned, sits in the platform-admin queue (M19) until
  // distributed to a broker org.
  @Column({ name: 'assigned_org_id', type: 'uuid', nullable: true })
  assignedOrgId: string | null;

  @ManyToOne(() => Organization, { nullable: true })
  @JoinColumn({ name: 'assigned_org_id' })
  assignedOrg: Organization | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
