import { ConflictException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User, UserPlan } from './user.entity';

function makeRepository() {
  return {
    findOneBy: jest.fn(),
    create: jest.fn((data: Partial<User>) => data as User),
    save: jest.fn(async (user: User) => user),
    update: jest.fn(),
  } as unknown as jest.Mocked<Repository<User>>;
}

describe('UsersService', () => {
  let usersRepository: jest.Mocked<Repository<User>>;
  let dataSource: DataSource;
  let service: UsersService;

  beforeEach(() => {
    usersRepository = makeRepository();
    dataSource = { transaction: jest.fn() } as unknown as DataSource;
    service = new UsersService(usersRepository, dataSource);
  });

  describe('findOrCreateFromGoogle', () => {
    it('returns the existing user when googleId already matches, without saving again', async () => {
      const existing = { id: 'u1', googleId: 'g1' } as User;
      usersRepository.findOneBy.mockResolvedValueOnce(existing);

      const result = await service.findOrCreateFromGoogle({
        googleId: 'g1',
        email: 'a@example.com',
        name: 'Ada',
      });

      expect(result).toBe(existing);
      expect(usersRepository.save).not.toHaveBeenCalled();
    });

    it('links googleId onto an existing password-only account matched by email', async () => {
      usersRepository.findOneBy
        .mockResolvedValueOnce(null) // no match by googleId
        .mockResolvedValueOnce({ id: 'u2', email: 'a@example.com', name: null, googleId: null } as User); // match by email

      const result = await service.findOrCreateFromGoogle({
        googleId: 'g2',
        email: 'a@example.com',
        name: 'Ada',
      });

      expect(result.googleId).toBe('g2');
      expect(result.name).toBe('Ada');
      expect(usersRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ googleId: 'g2', name: 'Ada' }),
      );
    });

    it('keeps the existing name when linking, rather than overwriting it from the Google profile', async () => {
      usersRepository.findOneBy
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'u2', email: 'a@example.com', name: 'Already Set', googleId: null } as User);

      const result = await service.findOrCreateFromGoogle({
        googleId: 'g2',
        email: 'a@example.com',
        name: 'From Google',
      });

      expect(result.name).toBe('Already Set');
    });

    it('creates a brand new user with no plan when neither googleId nor email match', async () => {
      usersRepository.findOneBy.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      const result = await service.findOrCreateFromGoogle({
        googleId: 'g3',
        email: 'new@example.com',
        name: 'New Person',
      });

      expect(result.plan).toBeNull();
      expect(usersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ googleId: 'g3', email: 'new@example.com', plan: null }),
      );
    });
  });

  describe('createWithPassword', () => {
    it('rejects when an account with that email already exists', async () => {
      usersRepository.findOneBy.mockResolvedValueOnce({ id: 'existing' } as User);

      await expect(
        service.createWithPassword({ name: 'A', email: 'taken@example.com', password: 'pw' }),
      ).rejects.toThrow(ConflictException);
      expect(usersRepository.save).not.toHaveBeenCalled();
    });

    it('creates a new password account with no plan when the email is free', async () => {
      usersRepository.findOneBy.mockResolvedValueOnce(null);

      const result = await service.createWithPassword({
        name: 'A',
        email: 'free@example.com',
        password: 'pw',
      });

      expect(result.plan).toBeNull();
      expect(result.email).toBe('free@example.com');
    });
  });

  describe('startTrial', () => {
    it('starts the trial for a user with neither a plan nor a prior trial', async () => {
      const user = { id: 'u1', plan: null, trialStartedAt: null } as User;
      const updated = { ...user, trialStartedAt: new Date() } as User;
      usersRepository.findOneBy.mockResolvedValueOnce(user).mockResolvedValueOnce(updated);

      const result = await service.startTrial('u1');

      expect(usersRepository.update).toHaveBeenCalledWith(
        { id: 'u1' },
        { trialStartedAt: expect.any(Date) },
      );
      expect(result).toBe(updated);
    });

    it('is idempotent for a user already mid-trial — returns unchanged, no update issued', async () => {
      const user = { id: 'u1', plan: null, trialStartedAt: new Date('2026-01-01') } as User;
      usersRepository.findOneBy.mockResolvedValueOnce(user);

      const result = await service.startTrial('u1');

      expect(usersRepository.update).not.toHaveBeenCalled();
      expect(result).toBe(user);
    });

    it('is a no-op for a user who already picked a real plan', async () => {
      const user = { id: 'u1', plan: UserPlan.PLUS, trialStartedAt: null } as User;
      usersRepository.findOneBy.mockResolvedValueOnce(user);

      const result = await service.startTrial('u1');

      expect(usersRepository.update).not.toHaveBeenCalled();
      expect(result).toBe(user);
    });

    it('throws when the user no longer exists', async () => {
      usersRepository.findOneBy.mockResolvedValueOnce(null);

      await expect(service.startTrial('missing')).rejects.toThrow('User not found');
    });
  });

  describe('setPreferences', () => {
    it('only updates the fields actually provided, leaving others untouched', async () => {
      const updated = { id: 'u1', name: 'New Name' } as User;
      usersRepository.findOneBy.mockResolvedValueOnce(updated);

      await service.setPreferences('u1', { name: 'New Name' });

      expect(usersRepository.update).toHaveBeenCalledWith({ id: 'u1' }, { name: 'New Name' });
    });
  });

  describe('setPlan', () => {
    it('updates the plan and returns the refreshed user', async () => {
      const updated = { id: 'u1', plan: UserPlan.PREMIUM } as User;
      usersRepository.findOneBy.mockResolvedValueOnce(updated);

      const result = await service.setPlan('u1', UserPlan.PREMIUM);

      expect(usersRepository.update).toHaveBeenCalledWith({ id: 'u1' }, { plan: UserPlan.PREMIUM });
      expect(result).toBe(updated);
    });
  });

  describe('deleteAccount', () => {
    it('deletes chats, items, suggestions, usage logs and the user in one transaction', async () => {
      const manager = { delete: jest.fn() };
      (dataSource.transaction as jest.Mock).mockImplementation(async (fn) => fn(manager));

      await service.deleteAccount('u1');

      expect(manager.delete).toHaveBeenCalledTimes(5);
    });
  });
});
