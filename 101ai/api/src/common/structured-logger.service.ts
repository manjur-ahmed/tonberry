import { LoggerService, LogLevel } from '@nestjs/common';
import { getRequestContext } from './request-context';

// Replaces Nest's default colorized-text logger app-wide (see main.ts/
// lambda.ts's app.useLogger(...)) with structured JSON lines — every
// existing `new Logger(ClassName.name)` call site across the app (see
// NewsClient/YoutubeClient/GoogleMapsClient etc.) keeps working completely
// unchanged; this only changes how Nest actually writes those calls out.
// One JSON object per line on stdout, which Lambda ships to CloudWatch
// automatically — turns "grep the logs" into a real CloudWatch Logs
// Insights query, e.g. `fields userId, message | filter userId = "..."`.
export class StructuredLogger implements LoggerService {
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('log', message, this.extractContext(optionalParams));
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, this.extractContext(optionalParams));
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, this.extractContext(optionalParams));
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, this.extractContext(optionalParams));
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, this.extractContext(optionalParams));
  }

  // Nest's Logger instance calls this as either (message, context) or
  // (message, stack, context) depending on whether the original caller
  // passed a stack trace — a single extra string param that looks
  // multi-line is treated as a stack, otherwise it's the context.
  error(message: unknown, ...optionalParams: unknown[]): void {
    let stack: string | undefined;
    let context: string | undefined;
    if (optionalParams.length >= 2) {
      [stack, context] = optionalParams as [string, string];
    } else if (optionalParams.length === 1) {
      const only = optionalParams[0];
      if (typeof only === 'string' && only.includes('\n')) stack = only;
      else context = only as string;
    }
    this.write('error', message, context, stack);
  }

  private extractContext(optionalParams: unknown[]): string | undefined {
    const last = optionalParams[optionalParams.length - 1];
    return typeof last === 'string' ? last : undefined;
  }

  private write(
    level: LogLevel,
    message: unknown,
    context?: string,
    stack?: string,
  ): void {
    const requestContext = getRequestContext();
    const line: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      context,
      requestId: requestContext?.requestId,
      userId: requestContext?.userId,
    };
    if (stack) line.stack = stack;

    // An Error instance (Nest's own BaseExceptionFilter calls
    // `logger.error(exception)` with the raw error, no separate message/
    // stack args — confirmed by reading its source) needs its own branch:
    // `message`/`stack` on a real Error are non-enumerable own properties,
    // so a generic Object.assign(line, error) silently copies neither and
    // the whole log line loses its actual content (confirmed empirically —
    // this was a real bug caught by the debug-trigger endpoint's http500
    // test, not a hypothetical).
    if (message instanceof Error) {
      line.message = message.message;
      if (!line.stack && message.stack) line.stack = message.stack;
    } else if (message !== null && typeof message === 'object') {
      // A plain object message (see RequestLoggingInterceptor's per-request
      // summary line) gets its own fields merged in directly — real
      // top-level JSON fields (method/path/statusCode/durationMs) are what
      // actually makes `fields ...` queries in CloudWatch Logs Insights
      // useful, versus burying them inside one opaque `message` string.
      Object.assign(line, message as Record<string, unknown>);
    } else {
      // The overwhelming majority of existing Logger.warn(...) calls across
      // the app: a plain string message.
      line.message = String(message);
    }

    process.stdout.write(`${JSON.stringify(line)}\n`);
  }
}
