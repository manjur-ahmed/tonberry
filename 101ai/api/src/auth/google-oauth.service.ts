import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleProfile } from '../users/users.service';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

// Hand-rolled OAuth2 code exchange — @nestjs/passport's AuthGuard('google')
// calls res.setHeader() internally for the initial redirect, an Express-only
// API that doesn't exist on Fastify's reply object. Two plain fetch calls
// sidestep that entirely.
@Injectable()
export class GoogleOAuthService {
  constructor(private readonly config: ConfigService) {}

  private get clientId(): string {
    return this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID') || 'not-configured';
  }

  private get clientSecret(): string {
    return (
      this.config.get<string>('GOOGLE_OAUTH_CLIENT_SECRET') || 'not-configured'
    );
  }

  private get callbackUrl(): string {
    return this.config.get<string>(
      'GOOGLE_CALLBACK_URL',
      'http://localhost:3001/auth/google/callback',
    );
  }

  getAuthorizationUrl(): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'select_account',
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.callbackUrl,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenResponse.ok) {
      throw new UnauthorizedException('Google token exchange failed');
    }
    const { access_token } = (await tokenResponse.json()) as {
      access_token: string;
    };

    const userInfoResponse = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!userInfoResponse.ok) {
      throw new UnauthorizedException('Could not fetch Google profile');
    }
    const profile = (await userInfoResponse.json()) as {
      sub: string;
      email?: string;
      name?: string;
    };
    if (!profile.email) {
      throw new UnauthorizedException('Google profile has no email');
    }

    return {
      googleId: profile.sub,
      email: profile.email,
      name: profile.name ?? null,
    };
  }
}
