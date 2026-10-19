import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { trace } from '@opentelemetry/api';

const HEADER = 'x-request-id';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Adds a stable per-request id to `req.id`, echoes it on the response as
 * `X-Request-Id`, and attaches it to the active span as `request.id`.
 *
 * Honours an incoming `X-Request-Id` from a trusted upstream (gateway, lb)
 * when it's a well-formed UUID, so a single id flows across hops. Otherwise
 * mints a fresh UUID v4.
 *
 * The id complements the OTel `traceId` — useful when the user reports a
 * problem and we want to find logs by an id we put in the response body /
 * error page.
 */
/**
 * Functional middleware — usable with plain `app.use(requestIdMiddleware)` so
 * `@hs/bootstrap` can wire it before NestJS guards/interceptors run.
 */
export function requestIdMiddleware(req: Request & { id?: string }, res: Response, next: NextFunction): void {
  const incoming = req.headers[HEADER];
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  const id = candidate && UUID_RE.test(candidate) ? candidate : randomUUID();

  req.id = id;
  res.setHeader('X-Request-Id', id);
  trace.getActiveSpan()?.setAttribute('request.id', id);

  next();
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use = requestIdMiddleware;
}
