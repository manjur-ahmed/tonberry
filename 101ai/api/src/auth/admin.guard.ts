import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/user.entity';

// Runs after JwtAuthGuard (see @UseGuards ordering on the controllers that
// use this), so request.user is already populated. No "admin" concept on
// the User entity/schema — this is a single-owner project, so an email
// allowlist via env var is the simplest thing that actually works.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user: User }>();
    const adminEmail = this.config.get<string>('ADMIN_EMAIL');
    if (!adminEmail || request.user?.email !== adminEmail) {
      throw new ForbiddenException('Admin access only');
    }
    return true;
  }
}
