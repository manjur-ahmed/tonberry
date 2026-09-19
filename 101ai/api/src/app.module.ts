import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RequestLoggingInterceptor } from './common/request-logging.interceptor';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ChatsModule } from './chats/chats.module';
import { ItemsModule } from './items/items.module';
import { UsageLogsModule } from './usage-logs/usage-logs.module';
import { UploadsModule } from './uploads/uploads.module';
import { NewsModule } from './news/news.module';
import { YoutubeModule } from './youtube/youtube.module';
import { DebugModule } from './debug/debug.module';
import { ImagesModule } from './images/images.module';
import { ActivityPlannerModule } from './activity-planner/activity-planner.module';
import { SuggestionsModule } from './suggestions/suggestions.module';
import { RecurringCostsModule } from './recurring-costs/recurring-costs.module';
import { User } from './users/user.entity';
import { Chat } from './chats/chat.entity';
import { Message } from './chats/message.entity';
import { Item } from './items/item.entity';
import { UsageLog } from './usage-logs/usage-log.entity';
import { Suggestion } from './suggestions/suggestion.entity';
import { RecurringCost } from './recurring-costs/recurring-cost.entity';

// Previously these silently fell back to an insecure placeholder
// ('dev-only-change-me' for JWT_SECRET, 'not-configured' for the Google
// OAuth id/secret — see git blame on auth.module.ts/jwt.strategy.ts/
// google-oauth.service.ts) if the env var was ever unset, which is exactly
// the kind of thing that's invisible until it's live in prod. Throwing here
// runs synchronously during ConfigModule.forRoot below, before the rest of
// the app even starts booting, so a missing value fails the deploy/local
// start outright instead of quietly serving traffic with a placeholder.
function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const required = ['JWT_SECRET', 'GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET'];
  const missing = required.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(
      `Refusing to start: missing required environment variable(s): ${missing.join(', ')}`,
    );
  }
  return config;
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // App-wide default — 100 req/min per IP. Individual endpoints override
    // this with a stricter limit via @Throttle() where it actually matters
    // (see AuthController's login/register), rather than every route
    // needing its own explicit config.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        return {
          type: 'postgres' as const,
          entities: [User, Chat, Message, Item, UsageLog, Suggestion, RecurringCost],
          // Migrations only (src/database/migrations) — never auto-sync.
          synchronize: false,
          // rejectUnauthorized: true — Neon's cert chains to a public,
          // Node-trusted root CA (confirmed by a real strict-TLS connect),
          // so there's no need to skip verification and accept a
          // MITM-able connection to get this working.
          ...(databaseUrl
            ? { url: databaseUrl, ssl: { rejectUnauthorized: true } }
            : {
                host: config.get<string>('DATABASE_HOST', 'localhost'),
                port: config.get<number>('DATABASE_PORT', 5432),
                username: config.get<string>('DATABASE_USER', 'tonberry'),
                password: config.get<string>('DATABASE_PASSWORD', 'tonberry'),
                database: config.get<string>('DATABASE_NAME', 'tonberry_101ai'),
              }),
        };
      },
    }),
    HealthModule,
    UsersModule,
    AuthModule,
    ChatsModule,
    ItemsModule,
    UsageLogsModule,
    UploadsModule,
    NewsModule,
    YoutubeModule,
    DebugModule,
    ImagesModule,
    ActivityPlannerModule,
    SuggestionsModule,
    RecurringCostsModule,
  ],
  providers: [
    // Global — every request gets a requestId/userId in its logs (see
    // RequestLoggingInterceptor's own comment for why this, not
    // REQUEST-scoped DI).
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
    // Global — every request is subject to the 'default' limit above unless
    // its own handler overrides it with @Throttle().
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
