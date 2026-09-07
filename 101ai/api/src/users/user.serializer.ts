import { User } from './user.entity';

// Every controller endpoint that returns a User must go through this —
// passwordHash must never appear in a response body. hasPassword tells the
// frontend whether to ask for a current password on /settings/password
// without exposing the hash itself.
export type PublicUser = Omit<User, 'passwordHash'> & { hasPassword: boolean };

export function toPublicUser(user: User): PublicUser {
  const { passwordHash, ...rest } = user;
  return { ...rest, hasPassword: !!passwordHash };
}
