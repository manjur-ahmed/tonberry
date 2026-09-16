import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { requestContextStorage } from './request-context';

// Applied globally (see app.module.ts's APP_INTERCEPTOR provider) — every
// request gets a requestId, plus the authenticated user's id once
// JwtAuthGuard has run (guards execute before interceptors in Nest's
// request lifecycle, so request.user is already populated here when a
// route is protected). Both are stashed in requestContextStorage (see
// request-context.ts) so StructuredLogger picks them up on every log line
// for the rest of this request's execution, however deep the call chain
// goes — then logs one structured summary line per request (method/path/
// statusCode/durationMs/userId), which alone is enough to answer "what did
// this specific customer's actions/API calls look like" via a CloudWatch
// Logs Insights query.
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const response = context.switchToHttp().getResponse<FastifyReply>();
    const requestId = randomUUID();
    // Undefined on a public route (health check, login, register, ...) —
    // that's a real anonymous request, not a bug.
    const userId = (request as unknown as { user?: { id?: string } }).user
      ?.id;
    const startedAt = Date.now();

    // next.handle() is a *lazy* Observable — piping it only builds a new
    // Observable, it doesn't run anything yet. Wrapping that construction in
    // requestContextStorage.run(...) does nothing useful, since the actual
    // subscription (where the route handler really executes, and where
    // tap()/catchError() actually fire) happens later, outside this
    // synchronous call, once Nest's interceptor chain gets around to
    // subscribing. AsyncLocalStorage only threads through async work that
    // was *started* synchronously inside run() — so the subscribe() call
    // itself has to happen inside run(), not just the pipe() construction.
    return new Observable((subscriber) => {
      requestContextStorage.run({ requestId, userId }, () => {
        const subscription = next
          .handle()
          .pipe(
            tap(() => this.logCompletion(request, response, startedAt)),
            catchError((error: unknown) => {
              // response.statusCode isn't set to its final value yet at
              // this point — the exception filter that actually writes the
              // error response runs *after* this catchError, further up the
              // chain. Reading it here always reported the pre-error
              // default (200), even for a real 500 (confirmed with the
              // debug-trigger endpoint's http500 test — a genuine bug, not
              // hypothetical). Derive the real status from the exception
              // itself instead.
              const statusCode =
                error instanceof HttpException ? error.getStatus() : 500;
              this.logCompletion(request, response, startedAt, statusCode);
              return throwError(() => error);
            }),
          )
          .subscribe(subscriber);
        return () => subscription.unsubscribe();
      });
    });
  }

  private logCompletion(
    request: FastifyRequest,
    response: FastifyReply,
    startedAt: number,
    statusCodeOverride?: number,
  ): void {
    this.logger.log({
      method: request.method,
      path: request.url,
      statusCode: statusCodeOverride ?? response.statusCode,
      durationMs: Date.now() - startedAt,
    });
  }
}
