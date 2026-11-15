import { maintenanceReportHtml, openRequestLines } from '../maintenance-report-template';
import { fallbackBrand } from '../../../common/utils/report-brand';

/** The maintenance report's open requests: one line each, most overdue first. */
const now = new Date('2026-11-15T12:00:00Z');
const row = (over: Record<string, unknown>) => ({
  createdAt: new Date('2026-11-01T09:00:00Z'),
  status: 'ASSIGNED',
  reviewStatus: 'APPROVED',
  priority: 'HIGH',
  dueAt: null as Date | null,
  description: 'تسريب   مياه\nفي الحمام',
  complaintAt: null as Date | null,
  customer: { fullName: 'سارة', phone: '+201000000001' },
  unit: { code: 'A-1', building: { phase: { project: { name: { ar: 'النخيل' } } } } },
  category: { name: { ar: 'سباكة' } },
  items: [] as Array<{ category: { name: unknown } | null }>,
  assignedAdmin: { fullName: 'مشرف' },
  ...over,
});

describe('openRequestLines', () => {
  it('labels, days late and open, categories from items, most overdue first', () => {
    const lines = openRequestLines(
      [
        row({}),
        row({
          dueAt: new Date('2026-11-10T12:00:00Z'),
          complaintAt: new Date('2026-11-12T00:00:00Z'),
          items: [{ category: { name: { ar: 'كهرباء' } } }, { category: { name: { ar: 'كهرباء' } } }, { category: { name: { ar: 'نجارة' } } }],
        }),
        row({ reviewStatus: 'PENDING', status: 'OPEN', assignedAdmin: null, priority: null }),
      ] as never,
      now,
    );
    expect(lines[0]).toMatchObject({ daysLate: 5, complaint: true, category: 'كهرباء، نجارة' });
    expect(lines[1]).toMatchObject({
      daysLate: 0,
      daysOpen: 14,
      priority: 'عالية',
      status: 'مسندة',
      category: 'سباكة',
      project: 'النخيل',
      description: 'تسريب مياه في الحمام',
    });
    expect(lines[2]).toMatchObject({ status: 'قيد المراجعة', assignee: 'غير مسند', priority: '—' });
  });

  it('the PDF lists them sideways with a count and the late total', () => {
    const open = openRequestLines([row({ dueAt: new Date('2026-11-10T12:00:00Z') })] as never, now);
    const html = maintenanceReportHtml(
      {
        totalRequests: 1, pendingReviewCount: 0, approvedCount: 1, rejectedCount: 0, openCount: 0,
        assignedCount: 1, inProgressCount: 0, resolvedCount: 0, closedCount: 0, overdueCount: 1,
        inWarrantyCount: 0, outOfWarrantyCount: 0, unknownWarrantyCount: 1, avgResolutionHours: null,
        resolvedWithinSlaCount: 0, resolvedOverdueCount: 0, slaAttainmentPercent: null, avgDelayHours: null,
        byCategory: [], byAssignee: [], expiringWarranties: [], filters: [],
        open,
      },
      fallbackBrand('EGP'),
    );
    expect(html).toContain('size: A4 landscape');
    expect(html).toContain('الطلبات المفتوحة');
    expect(html).toContain('+201000000001');
    expect(html).toContain('التأخير (يوم)');
  });
});
