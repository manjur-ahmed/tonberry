import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './health/health.module';
import { LeadsModule } from './leads/leads.module';
import { SystemStatusModule } from './system-status/system-status.module';
import { Organization } from './organizations/organization.entity';
import { User } from './users/user.entity';
import { Lead } from './leads/lead.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DATABASE_HOST', 'localhost'),
        port: config.get<number>('DATABASE_PORT', 5432),
        username: config.get<string>('DATABASE_USER', 'tonberry'),
        password: config.get<string>('DATABASE_PASSWORD', 'tonberry'),
        database: config.get<string>('DATABASE_NAME', 'tonberry'),
        entities: [Organization, User, Lead],
        // Migrations only (src/database/migrations) — never auto-sync.
        synchronize: false,
      }),
    }),
    HealthModule,
    LeadsModule,
    SystemStatusModule,
  ],
})
export class AppModule {}
