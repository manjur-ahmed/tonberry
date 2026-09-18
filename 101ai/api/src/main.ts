import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { StructuredLogger } from './common/structured-logger.service';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );
  // Structured JSON logs (see StructuredLogger) — every existing
  // Logger.warn(...)/log(...) call across the app routes through this
  // instead of Nest's default colorized text, with requestId/userId
  // automatically attached (see RequestLoggingInterceptor).
  app.useLogger(new StructuredLogger());
  // Fastify's CORS default methods list is just GET,HEAD,POST — missing
  // PATCH/PUT/DELETE, unlike the Express `cors` package's default.
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5174',
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
