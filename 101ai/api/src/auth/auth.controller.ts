import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { FastifyReply } from 'fastify';
import { GoogleOAuthService } from './google-oauth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { toPublicUser } from '../users/user.serializer';

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
    return res.redirect(this.googleOAuth.getAuthorizationUrl(), 302);
  }

  @Get('google/callback')
  async googleAuthCallback(
    @Query('code') code: string,
    @Res() res: FastifyReply,
  ) {
    const profile = await this.googleOAuth.exchangeCodeForProfile(code);
    const user = await this.usersService.findOrCreateFromGoogle(profile);
    const token = this.jwtService.sign({ sub: user.id });
    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:5174',
    );
    return res.redirect(`${frontendUrl}/auth/callback?token=${token}`, 302);
  }

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
