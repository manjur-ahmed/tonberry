import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';

export enum UserRole {
  PLATFORM_ADMIN = 'platform_admin',
  BROKER = 'broker',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  // Nullable until M12 wires up signup/login and password hashing.
  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash: string | null;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  // Null for platform_admin; required for broker users.
  @Column({ name: 'org_id', type: 'uuid', nullable: true })
  orgId: string | null;

  @ManyToOne(() => Organization, { nullable: true })
  @JoinColumn({ name: 'org_id' })
  organization: Organization | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
