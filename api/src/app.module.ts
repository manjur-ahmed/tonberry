import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './health/health.module';
import { LeadsModule } from './leads/leads.module';
import { ContactModule } from './contact/contact.module';
import { SystemStatusModule } from './system-status/system-status.module';
import { Organization } from './organizations/organization.entity';
import { User } from './users/user.entity';
import { Lead } from './leads/lead.entity';
import { ContactMessage } from './contact/contact-message.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        return {
          type: 'postgres' as const,
          entities: [Organization, User, Lead, ContactMessage],
          // Migrations only (src/database/migrations) — never auto-sync.
          synchronize: false,
          ...(databaseUrl
            ? { url: databaseUrl, ssl: { rejectUnauthorized: false } }
            : {
                host: config.get<string>('DATABASE_HOST', 'localhost'),
                port: config.get<number>('DATABASE_PORT', 5432),
                username: config.get<string>('DATABASE_USER', 'tonberry'),
                password: config.get<string>('DATABASE_PASSWORD', 'tonberry'),
                database: config.get<string>('DATABASE_NAME', 'tonberry'),
              }),
        };
      },
    }),
    HealthModule,
    LeadsModule,
    ContactModule,
    SystemStatusModule,
  ],
})
export class AppModule {}
