import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import awsLambdaFastify from '@fastify/aws-lambda';
import { AppModule } from './app.module';
import { StructuredLogger } from './common/structured-logger.service';

// Not using the library's own PromiseHandler/CallbackHandler types: with a
// default ESM import, ReturnType<typeof awsLambdaFastify> resolves to the
// last (callback-style) overload, and the namespace-merged type isn't
// visible on the aliased import either. A minimal local type sidesteps both.
type Handler = (event: unknown, context: unknown) => Promise<unknown>;

let cachedHandler: Handler | undefined;

async function bootstrap(): Promise<Handler> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  // Structured JSON logs (see StructuredLogger) — every existing
  // Logger.warn(...)/log(...) call across the app routes through this
  // instead of Nest's default colorized text, with requestId/userId
  // automatically attached (see RequestLoggingInterceptor). This is the
  // path that actually matters in prod — CloudWatch stores whatever this
  // Lambda writes to stdout.
  app.useLogger(new StructuredLogger());
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5174',
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return awsLambdaFastify(app.getHttpAdapter().getInstance());
}

export const handler: Handler = async (event, context) => {
  if (!cachedHandler) {
    cachedHandler = await bootstrap();
  }
  return cachedHandler(event, context);
};
