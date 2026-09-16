import { AsyncLocalStorage } from 'node:async_hooks';

// Carries the current request's correlation ids through any async call
// chain — including deep inside a service/client several layers below the
// route handler (NewsClient, YoutubeClient, GoogleMapsClient, ...) — without
// threading requestId/userId through every function signature, or making
// half the DI graph request-scoped (NestJS's own REQUEST-scoped provider
// mechanism does that and has a real performance cost; this doesn't).
// Populated once per request by RequestLoggingInterceptor, read by
// StructuredLogger so every log line — including one from deep inside a
// client's own `this.logger.warn(...)` call — carries the same ids
// automatically, with no changes needed at any of those call sites.
export interface RequestContext {
  requestId: string;
  userId?: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}
