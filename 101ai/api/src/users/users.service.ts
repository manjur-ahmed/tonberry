import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserPlan } from './user.entity';
import { Chat } from '../chats/chat.entity';
import { Item } from '../items/item.entity';
import { Suggestion } from '../suggestions/suggestion.entity';
import { UsageLog } from '../usage-logs/usage-log.entity';

const PASSWORD_HASH_ROUNDS = 10;

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    // Only used by deleteAccount below, to reach Chat/Item/Suggestion/
    // UsageLog in one transaction without this module taking on a
    // dependency on ChatsModule/ItemsModule/etc — DataSource already has
    // every entity registered app-wide, no per-module forFeature needed.
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  async findOrCreateFromGoogle(profile: GoogleProfile): Promise<User> {
    const existing = await this.usersRepository.findOneBy({
      googleId: profile.googleId,
    });
    if (existing) return existing;

    // Google account signing in with an email that already has a
    // (currently password-less) row — link it rather than erroring on the
    // unique email constraint.
    const byEmail = await this.usersRepository.findOneBy({
      email: profile.email,
    });
    if (byEmail) {
      byEmail.googleId = profile.googleId;
      byEmail.name = byEmail.name ?? profile.name;
      return this.usersRepository.save(byEmail);
    }

    const user = this.usersRepository.create({
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      plan: null,
    });
    return this.usersRepository.save(user);
  }

  async createWithPassword(params: {
    name: string;
    email: string;
    password: string;
  }): Promise<User> {
    const existing = await this.usersRepository.findOneBy({
      email: params.email,
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(
      params.password,
      PASSWORD_HASH_ROUNDS,
    );
    const user = this.usersRepository.create({
      email: params.email,
      name: params.name,
      passwordHash,
      plan: null,
    });
    return this.usersRepository.save(user);
  }

  async setPlan(id: string, plan: UserPlan): Promise<User> {
    await this.usersRepository.update({ id }, { plan });
    const user = await this.findById(id);
    if (!user) throw new Error('User not found after plan update');
    return user;
  }

  // Idempotent — a user who's already trialing (or already picked a real
  // plan) and calls this again just gets their existing state back
  // unchanged, rather than the clock resetting on a repeat click.
  async startTrial(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new Error('User not found');
    if (user.trialStartedAt || user.plan) return user;
    await this.usersRepository.update({ id }, { trialStartedAt: new Date() });
    const updated = await this.findById(id);
    if (!updated) throw new Error('User not found after starting trial');
    return updated;
  }

  // Partial by design — see SetPreferencesDto's comment. The controller
  // only ever includes a key here when that field was actually present in
  // the request, so TypeORM's update() only touches those columns, leaving
  // everything else (already saved by an earlier onboarding step) alone.
  async setPreferences(
    id: string,
    preferences: Partial<{
      name: string;
      otherNames: string | null;
      country: string;
      darkTheme: boolean;
      dateOfBirth: string | null;
    }>,
  ): Promise<User> {
    await this.usersRepository.update({ id }, preferences);
    const user = await this.findById(id);
    if (!user) throw new Error('User not found after preferences update');
    return user;
  }

  async setPassword(id: string, newPassword: string): Promise<User> {
    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_HASH_ROUNDS);
    await this.usersRepository.update({ id }, { passwordHash });
    const updated = await this.findById(id);
    if (!updated) throw new Error('User not found after password update');
    return updated;
  }

  // Real erasure, not just sign-out — chats (and their messages, via the
  // existing cascade), items, suggestions, and usage logs (which carry the
  // real prompt/response text, not just anonymous metrics — see
  // RecordUsageParams) all get cleared alongside the user row itself.
  // None of these have an enforced FK back to users (unlike chat_messages
  // -> chats), so this is done explicitly rather than relying on cascade,
  // and wrapped in one transaction so a failure partway through can't leave
  // the account half-deleted.
  async deleteAccount(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(Chat, { userId: id });
      await manager.delete(Item, { userId: id });
      await manager.delete(Suggestion, { userId: id });
      await manager.delete(UsageLog, { userId: id });
      await manager.delete(User, { id });
    });
  }
}
