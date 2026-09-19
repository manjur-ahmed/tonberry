import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminGuard } from './admin.guard';
import { User } from '../users/user.entity';

function makeContext(user: Partial<User> | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  function makeGuard(adminEmail: string | undefined) {
    const config = { get: jest.fn().mockReturnValue(adminEmail) } as unknown as ConfigService;
    return new AdminGuard(config);
  }

  it('allows a request from the configured admin email', () => {
    const guard = makeGuard('admin@example.com');
    const context = makeContext({ email: 'admin@example.com' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a request from any other authenticated user', () => {
    const guard = makeGuard('admin@example.com');
    const context = makeContext({ email: 'someone-else@example.com' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects when there is no user on the request at all', () => {
    const guard = makeGuard('admin@example.com');
    const context = makeContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects everyone when ADMIN_EMAIL is unset, even a matching-looking email', () => {
    const guard = makeGuard(undefined);
    const context = makeContext({ email: 'admin@example.com' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
