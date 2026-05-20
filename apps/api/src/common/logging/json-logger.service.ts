import { ConsoleLogger, type LogLevel } from '@nestjs/common';

/**
 * Console logger that can emit one-line JSON for production log aggregators
 * (Datadog, CloudWatch, Loki, …). Selection:
 *
 *   * `LOG_FORMAT=json`   → JSON output, regardless of NODE_ENV
 *   * `LOG_FORMAT=pretty` → default Nest pretty output
 *   * unset               → JSON in production, pretty everywhere else
 *
 * Pretty mode is just `super` — we never need to re-implement Nest's coloured
 * formatter and we don't fight with `bufferLogs: true`.
 */
export class JsonLoggerService extends ConsoleLogger {
  private readonly jsonMode: boolean;

  constructor() {
    super();
    const fmt = (process.env.LOG_FORMAT ?? '').toLowerCase();
    if (fmt === 'json') this.jsonMode = true;
    else if (fmt === 'pretty') this.jsonMode = false;
    else this.jsonMode = process.env.NODE_ENV === 'production';
  }

  protected emit(level: LogLevel, message: unknown, context?: string): void {
    if (!this.jsonMode) {
      // Defer to ConsoleLogger's coloured output.
      switch (level) {
        case 'error':
          super.error(message as string, context);
          return;
        case 'warn':
          super.warn(message as string, context);
          return;
        case 'debug':
          super.debug?.(message as string, context);
          return;
        case 'verbose':
          super.verbose?.(message as string, context);
          return;
        default:
          super.log(message as string, context);
      }
      return;
    }

    const payload: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      context: context ?? null,
    };

    if (typeof message === 'string') {
      payload.message = message;
    } else if (message && typeof message === 'object') {
      // Object-form messages from interceptors flow through as structured fields.
      Object.assign(payload, message as Record<string, unknown>);
    } else {
      payload.message = String(message);
    }

    process.stdout.write(JSON.stringify(payload) + '\n');
  }

  log(message: unknown, context?: string): void {
    this.emit('log', message, context);
  }
  error(message: unknown, stackOrContext?: string, context?: string): void {
    const ctx = context ?? (typeof stackOrContext === 'string' && stackOrContext.length < 80 ? stackOrContext : undefined);
    if (this.jsonMode && typeof stackOrContext === 'string' && stackOrContext.length >= 80) {
      this.emit('error', { message, stack: stackOrContext }, ctx);
    } else {
      this.emit('error', message, ctx);
    }
  }
  warn(message: unknown, context?: string): void {
    this.emit('warn', message, context);
  }
  debug(message: unknown, context?: string): void {
    this.emit('debug', message, context);
  }
  verbose(message: unknown, context?: string): void {
    this.emit('verbose', message, context);
  }
}
