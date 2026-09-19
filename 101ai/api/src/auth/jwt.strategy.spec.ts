import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

describe('JwtStrategy', () => {
  function makeStrategy(usersService: Partial<UsersService>) {
    const config = { get: jest.fn().mockReturnValue('dev-only-change-me') } as unknown as ConfigService;
    return new JwtStrategy(config, usersService as UsersService);
  }

  it('returns the user for a payload whose sub resolves to a real user', async () => {
    const user = { id: 'user-1', email: 'a@example.com' } as User;
    const usersService = { findById: jest.fn().mockResolvedValue(user) };
    const strategy = makeStrategy(usersService);

    await expect(strategy.validate({ sub: 'user-1' })).resolves.toBe(user);
    expect(usersService.findById).toHaveBeenCalledWith('user-1');
  });

  it('throws UnauthorizedException when the payload sub matches no user (e.g. a deleted account)', async () => {
    const usersService = { findById: jest.fn().mockResolvedValue(null) };
    const strategy = makeStrategy(usersService);

    await expect(strategy.validate({ sub: 'gone' })).rejects.toThrow(UnauthorizedException);
  });
});
