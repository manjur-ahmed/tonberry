import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { GoogleOAuthService } from './google-oauth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { toPublicUser } from '../users/user.serializer';

// No cookie plugin registered on the Fastify instance (nothing else in this
// stateless, JWT-only app needs one) — a single opaque value is simple
// enough to set/read via the raw Cookie/Set-Cookie headers directly rather
// than pulling in @fastify/cookie for it.
const OAUTH_STATE_COOKIE = 'oauth_state';

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly googleOAuth: GoogleOAuthService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  @Get('google')
  googleAuth(@Res() res: FastifyReply) {
    // Random, unguessable, and tied to THIS browser via a short-lived
    // cookie — googleAuthCallback below rejects the flow unless the same
    // value comes back both ways, which is what actually stops an attacker
    // from replaying their own authorization code in a victim's browser
    // (see getAuthorizationUrl's comment).
    const state = randomBytes(16).toString('hex');
    res.header(
      'Set-Cookie',
      `${OAUTH_STATE_COOKIE}=${state}; HttpOnly; SameSite=Lax; Max-Age=300; Path=/auth/google`,
    );
    return res.redirect(this.googleOAuth.getAuthorizationUrl(state), 302);
  }

  @Get('google/callback')
  async googleAuthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    // Single-use — clear it regardless of whether it matches.
    res.header(
      'Set-Cookie',
      `${OAUTH_STATE_COOKIE}=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/auth/google`,
    );
    const cookieState = readCookie(req.headers.cookie, OAUTH_STATE_COOKIE);
    if (!state || !cookieState || state !== cookieState) {
      throw new UnauthorizedException('Invalid or missing OAuth state');
    }

    const profile = await this.googleOAuth.exchangeCodeForProfile(code);
    const user = await this.usersService.findOrCreateFromGoogle(profile);
    const token = this.jwtService.sign({ sub: user.id });
    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:5174',
    );
    return res.redirect(`${frontendUrl}/auth/callback?token=${token}`, 302);
  }

  // Stricter than the app-wide default (see ThrottlerModule.forRoot in
  // app.module.ts) — these two are the actual credential-guessing/spam-
  // account-creation targets, unlike most other public endpoints.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await this.usersService.createWithPassword(dto);
    const token = this.jwtService.sign({ sub: user.id });
    return { token };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    // Same error either way — don't let a caller distinguish "no such
    // account" from "wrong password".
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) throw new UnauthorizedException('Invalid email or password');

    const token = this.jwtService.sign({ sub: user.id });
    return { token };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return toPublicUser(user);
  }
}
