import { lastValueFrom, Observable } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { ReportIssuerInterceptor } from '../report-issuer.interceptor';
import { reportIssuer, runWithReportIssuer } from '../../report-pdf/report-issuer';
import { reportDocument } from '../../report-pdf/report-html';
import { addFooter } from '../../utils/xlsx';
import { fallbackBrand } from '../../utils/report-brand';
import { runInCompany } from '../../tenant/tenant-context';

/** Every exported report says who issued it («أصدره»). */
function ctx(method: string, path: string, user?: { sub: string }): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ method, path, user }) }),
  } as unknown as ExecutionContext;
}
/** A handler that reports the issuer it sees. */
const seen: CallHandler = { handle: () => new Observable((s) => { s.next(reportIssuer() ?? null); s.complete(); }) };

function setup(findFirst: jest.Mock) {
  return new ReportIssuerInterceptor({ user: { findFirst } } as never);
}
const COMPANY = '00000000-0000-0000-0000-0000000000aa';
/** Runs the interceptor in a company, as the tenant interceptor would have. */
const inCompany = <T>(fn: () => Promise<T>) => runInCompany(COMPANY, fn);

describe('ReportIssuerInterceptor', () => {
  it('names the signed-in user on an export (PDF, Excel, /export)', async () => {
    const find = jest.fn().mockResolvedValue({ fullName: 'منى الإدارة' });
    const i = setup(find);
    for (const path of ['/v1/reports/sales/export.pdf', '/v1/units/export.xlsx', '/v1/data/export']) {
      expect(await inCompany(() => lastValueFrom(i.intercept(ctx('GET', path, { sub: 'u1' }), seen)))).toBe('منى الإدارة');
    }
    // Looked up within the caller's company.
    expect(find.mock.calls[0][0].where).toEqual({ id: 'u1', companyId: COMPANY });
  });

  it('leaves other requests alone (no lookup)', async () => {
    const find = jest.fn();
    const i = setup(find);
    expect(await lastValueFrom(i.intercept(ctx('GET', '/v1/reports/sales', { sub: 'u1' }), seen))).toBeNull();
    expect(await lastValueFrom(i.intercept(ctx('POST', '/v1/units/export.xlsx', { sub: 'u1' }), seen))).toBeNull();
    expect(await lastValueFrom(i.intercept(ctx('GET', '/v1/units/export.xlsx'), seen))).toBeNull();
    expect(find).not.toHaveBeenCalled();
  });

  it('a failed lookup still exports, with no name', async () => {
    const i = setup(jest.fn().mockRejectedValue(new Error('db down')));
    expect(await inCompany(() => lastValueFrom(i.intercept(ctx('GET', '/v1/units/export.xlsx', { sub: 'u1' }), seen)))).toBeNull();
    // No company (a platform request): no lookup, no name, still exports.
    expect(await lastValueFrom(setup(jest.fn()).intercept(ctx('GET', '/v1/units/export.xlsx', { sub: 'u1' }), seen))).toBeNull();
  });
});

describe('the issuer on the files', () => {
  it('PDF: a «أصدره» fact card; none outside an export', () => {
    const brand = fallbackBrand('EGP');
    const html = runWithReportIssuer('منى الإدارة', () => reportDocument({ brand, title: 'تقرير', body: '' }));
    expect(html).toContain('<dt>أصدره</dt>');
    expect(html).toContain('منى الإدارة');
    expect(reportDocument({ brand, title: 'تقرير', body: '' })).not.toContain('أصدره');
  });

  it('Excel: the footer says who issued it', () => {
    const ws = new Workbook().addWorksheet('s');
    runWithReportIssuer('منى الإدارة', () => addFooter(ws, { name: 'شركة' }));
    expect(String(ws.getRow(ws.rowCount).getCell(1).value)).toBe('صادر عن شركة · أصدره: منى الإدارة');
  });
});

