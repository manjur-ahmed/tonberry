import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { User } from '../users/user.entity';
import { Chat } from '../chats/chat.entity';
import { Message } from '../chats/message.entity';
import { Item } from '../items/item.entity';

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
      database: process.env.DATABASE_NAME ?? 'tonberry_101ai',
    };

export default new DataSource({
  ...connectionOptions,
  entities: [User, Chat, Message, Item],
  migrations: ['src/database/migrations/*.ts'],
});
