import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ChatsModule } from './chats/chats.module';
import { ItemsModule } from './items/items.module';
import { UsageLogsModule } from './usage-logs/usage-logs.module';
import { User } from './users/user.entity';
import { Chat } from './chats/chat.entity';
import { Message } from './chats/message.entity';
import { Item } from './items/item.entity';
import { UsageLog } from './usage-logs/usage-log.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        return {
          type: 'postgres' as const,
          entities: [User, Chat, Message, Item, UsageLog],
          // Migrations only (src/database/migrations) — never auto-sync.
          synchronize: false,
          ...(databaseUrl
            ? { url: databaseUrl, ssl: { rejectUnauthorized: false } }
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
  ],
})
export class AppModule {}
