import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { translateErrorMessage } from '../i18n/error-catalogue';

/** True when the client asked for Arabic (`X-Locale` first, then `Accept-Language`). */
export function wantsArabic(headers: Record<string, string | string[] | undefined>): boolean {
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const candidate = (pick(headers['x-locale']) || pick(headers['accept-language'])).trim().toLowerCase();
  return candidate.startsWith('ar');
}

/** The same exception with its message(s) in Arabic. Other fields of the body (code, permissions…) stay. */
export function arabicException(exception: HttpException): HttpException {
  const res = exception.getResponse();
  const tr = (m: unknown) => (typeof m === 'string' ? translateErrorMessage(m) : m);
  let body: string | object;
  if (typeof res === 'string') {
    body = translateErrorMessage(res);
  } else if (res && typeof res === 'object') {
    const o = { ...(res as Record<string, unknown>) };
    if (Array.isArray(o.message)) o.message = o.message.map(tr);
    else if (typeof o.message === 'string') o.message = tr(o.message);
    body = o;
  } else {
    return exception;
  }
  return new HttpException(body, exception.getStatus());
}

/**
 * Nest's own error answer, with the message in Arabic for a client that asks for Arabic (F-023). A client
 * that does not (the tests, scripts, an English dashboard) gets the English text exactly as before.
 */
@Catch()
export class LocalizedErrorFilter extends BaseExceptionFilter {
  private readonly log = new Logger('ExceptionsHandler');

  override catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() === 'http') {
      const req = host.switchToHttp().getRequest<{ headers?: Record<string, string | string[] | undefined> }>();
      if (req?.headers && wantsArabic(req.headers)) {
        if (exception instanceof HttpException) {
          super.catch(arabicException(exception), host);
          return;
        }
        // An unexpected error: log it as Nest would, answer a 500 in Arabic.
        const err = exception as { message?: string; stack?: string } | null;
        this.log.error(err?.message ?? String(exception), err?.stack);
        super.catch(arabicException(new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR)), host);
        return;
      }
    }
    super.catch(exception, host);
  }
}
