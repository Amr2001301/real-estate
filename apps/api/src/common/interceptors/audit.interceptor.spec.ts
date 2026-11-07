import { of, lastValueFrom } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { AuditInterceptor } from './audit.interceptor';
import type { PrismaService } from '../prisma/prisma.service';

/** F-058: a data export (a GET) used to leave no audit row. */
function run(method: string, url: string, user: { sub: string } | undefined = { sub: 'u1' }, query: unknown = {}) {
  const create = jest.fn().mockResolvedValue({});
  const interceptor = new AuditInterceptor({ auditLog: { create } } as unknown as PrismaService);
  const ctx = {
    switchToHttp: () => ({ getRequest: () => ({ method, originalUrl: url, user, ip: '10.0.0.1', params: {}, query }) }),
  } as unknown as ExecutionContext;
  const next = { handle: () => of({ ok: true }) } as CallHandler;
  return lastValueFrom(interceptor.intercept(ctx, next)).then(() => create);
}

describe('AuditInterceptor', () => {
  it('records who downloaded an export, with its filters', async () => {
    const create = await run('GET', '/v1/reports/sales/export.csv?from=2026-01-01', { sub: 'admin-1' }, { from: '2026-01-01' });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]![0].data).toMatchObject({
      actorId: 'admin-1',
      action: 'EXPORT',
      entityType: 'v1/reports/sales',
      after: { path: '/v1/reports/sales/export.csv', filters: { from: '2026-01-01' } },
    });
  });

  it('records xlsx and pdf exports too, and a plain /export', async () => {
    for (const url of ['/v1/reports/financial/export.xlsx', '/v1/reports/sales/export.pdf', '/v1/units/export']) {
      expect((await run('GET', url)).mock.calls).toHaveLength(1);
    }
  });

  it('does not record ordinary reads', async () => {
    expect((await run('GET', '/v1/leads?pageSize=20')).mock.calls).toHaveLength(0);
    expect((await run('GET', '/v1/reports/sales')).mock.calls).toHaveLength(0);
  });

  it('still records mutations as before', async () => {
    const create = await run('POST', '/v1/leads');
    expect(create.mock.calls[0]![0].data).toMatchObject({ action: 'POST', entityType: 'v1/leads' });
  });
});
