import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserPlan } from './user.entity';

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
  ) {}

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
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

  async setPlan(id: string, plan: UserPlan): Promise<User> {
    await this.usersRepository.update({ id }, { plan });
    const user = await this.findById(id);
    if (!user) throw new Error('User not found after plan update');
    return user;
  }

  async setPreferences(
    id: string,
    preferences: { name: string; otherNames: string | null; country: string; darkTheme: boolean },
  ): Promise<User> {
    await this.usersRepository.update({ id }, preferences);
    const user = await this.findById(id);
    if (!user) throw new Error('User not found after preferences update');
    return user;
  }
}
