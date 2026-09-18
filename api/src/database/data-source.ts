import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';
import { Lead } from '../leads/lead.entity';
import { ContactMessage } from '../contact/contact-message.entity';

// DATABASE_URL (Neon, etc.) takes priority over discrete host/port/user/pass
// — the latter is only for local Docker Compose Postgres.
const connectionOptions: DataSourceOptions = process.env.DATABASE_URL
  ? {
      type: 'postgres',
      url: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    }
  : {
      type: 'postgres',
      host: process.env.DATABASE_HOST ?? 'localhost',
      port: Number(process.env.DATABASE_PORT ?? 5432),
      username: process.env.DATABASE_USER ?? 'tonberry',
      password: process.env.DATABASE_PASSWORD ?? 'tonberry',
      database: process.env.DATABASE_NAME ?? 'tonberry',
    };

export default new DataSource({
  ...connectionOptions,
  entities: [Organization, User, Lead, ContactMessage],
  migrations: ['src/database/migrations/*.ts'],
});
