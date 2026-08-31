import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';
import { Lead } from '../leads/lead.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USER ?? 'tonberry',
  password: process.env.DATABASE_PASSWORD ?? 'tonberry',
  database: process.env.DATABASE_NAME ?? 'tonberry',
  entities: [Organization, User, Lead],
  migrations: ['src/database/migrations/*.ts'],
});
