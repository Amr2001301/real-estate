import {
  Module,
  NestModule,
  MiddlewareConsumer,
  Injectable,
  NestMiddleware,
  Controller,
  Get,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, NextFunction } from 'express';
import { Public } from '../decorators/public.decorator';
import { register, collectDefaultMetrics, Counter, Histogram } from 'prom-client';

// Collect Node.js default metrics (GC, event loop, memory).
collectDefaultMetrics({ register });

/** Total HTTP request count, labelled by method, route, and status code. */
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

/** HTTP request duration histogram (milliseconds). */
export const httpRequestDurationMs = new Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  registers: [register],
});

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    res.on('finish', () => {
      // Use the matched Express route pattern (e.g. /v1/units/:id)
      // rather than the concrete URL to avoid high-cardinality labels.
      const route = (req.route?.path as string | undefined) ?? req.path ?? 'unknown';
      const labels = {
        method: req.method,
        route,
        status_code: String(res.statusCode),
      };
      const durationMs = Date.now() - start;
      httpRequestsTotal.inc(labels);
      httpRequestDurationMs.observe(labels, durationMs);
    });
    next();
  }
}

@Controller()
class MetricsController {
  constructor(private readonly config: ConfigService) {}

  // JWT is bypassed (@Public) so Prometheus scrapers can reach this without
  // a user token. Authorization is enforced inside the handler via METRICS_TOKEN:
  // if the env var is set, the caller must present it as Bearer <token>.
  // Without the env var the endpoint is open — set METRICS_TOKEN in production.
  @Public()
  @Get('metrics')
  async metrics(@Res() res: Response) {
    // Read directly from process.env so tests that set the var at runtime
    // (after app startup) are observed — ConfigService caches at startup.
    const token = process.env['METRICS_TOKEN'];
    if (token) {
      const authHeader = (res.req as Request).headers['authorization'] ?? '';
      const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      if (provided !== token) {
        res.status(401).end('Unauthorized');
        return;
      }
    }
    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  }
}

@Module({
  controllers: [MetricsController],
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
