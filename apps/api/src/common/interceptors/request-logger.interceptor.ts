import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { captureExceptionSafe } from '../observability/sentry';

interface MinimalReq {
  id?: string;
  method?: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  headers?: Record<string, unknown>;
  user?: { sub?: string };
}

/**
 * Logs one structured line per HTTP request. The line carries only metadata
 * — never the request body, query string, response payload, or any header
 * value. Request id (`req.id`) is set upstream by RequestIdMiddleware so each
 * line is correlatable with the client's `x-request-id` response header.
 *
 * On 5xx (or unknown-status) errors the exception is also forwarded to
 * Sentry via `captureExceptionSafe` — itself a no-op when SENTRY_DSN is unset.
 */
@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  private readonly log = new Logger('Http');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<MinimalReq>();
    const res = http.getResponse<{ statusCode?: number }>();

    const start = process.hrtime.bigint();
    const method = req.method ?? 'GET';
    // Strip query string to avoid logging ?token=… style leakage.
    const fullPath = req.originalUrl ?? req.url ?? '';
    const path = fullPath.split('?', 1)[0] ?? fullPath;

    const userAgentHeader = req.headers?.['user-agent'];
    const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;

    const baseMeta = {
      type: 'http' as const,
      requestId: req.id ?? null,
      method,
      path,
      userId: req.user?.sub ?? null,
      ip: req.ip ?? null,
      userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 256) : null,
    };

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Number((process.hrtime.bigint() - start) / 1_000_000n);
          this.log.log({ ...baseMeta, status: res.statusCode ?? 200, durationMs });
        },
        error: (err: unknown) => {
          const durationMs = Number((process.hrtime.bigint() - start) / 1_000_000n);
          const status = typeof (err as { status?: unknown })?.status === 'number'
            ? (err as { status: number }).status
            : 500;
          const errorName = (err as { name?: string })?.name ?? 'Error';
          const errorMessage = (err as { message?: string })?.message ?? '';

          this.log.error({
            ...baseMeta,
            status,
            durationMs,
            errorName,
            errorMessage,
          });

          if (status >= 500) {
            captureExceptionSafe(err, { requestId: baseMeta.requestId ?? 'none', path });
          }
        },
      }),
    );
  }
}
