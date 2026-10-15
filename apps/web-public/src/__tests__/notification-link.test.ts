/**
 * @jest-environment node
 */
import { notificationHref } from '@/lib/notification-link';
import { notificationTitle } from '@/lib/notification-title';
import { routes } from '@/lib/routes';

describe('notificationHref', () => {
  it('opens the maintenance request itself', () => {
    expect(notificationHref({ entityType: 'maintenance', entityId: 'mr-1' })).toBe(
      `${routes.accountMaintenance}/mr-1`,
    );
  });

  it('sends an installment notice filed under its contract to the installments page', () => {
    expect(
      notificationHref({ entityType: 'contract', entityId: 'c-1', installmentId: 'i-1' }),
    ).toBe(routes.accountInstallments);
    expect(notificationHref({ entityType: 'contract', entityId: 'c-1' })).toBe(
      routes.accountContracts,
    );
  });

  it('routes visit and inquiry requests', () => {
    expect(notificationHref({ entityType: 'visit_request', entityId: 'v-1' })).toBe(
      routes.accountVisits,
    );
    expect(notificationHref({ entityType: 'info_request', entityId: 'q-1' })).toBe(
      routes.accountRequests,
    );
  });

  it('has no link for an unknown payload', () => {
    expect(notificationHref(null)).toBeNull();
    expect(notificationHref({ foo: 'bar' })).toBeNull();
  });
});

describe('notificationTitle', () => {
  it('prefers the server title, falling back to the label map', () => {
    expect(notificationTitle('deposit_verified', 'تم اعتماد دفعة بقيمة 25,000 ج.م')).toBe(
      'تم اعتماد دفعة بقيمة 25,000 ج.م',
    );
    expect(notificationTitle('deposit_verified')).toBe('تم اعتماد دفعتك');
    // A template-less row comes back titled with its own code: not a title.
    expect(notificationTitle('mystery_code', 'mystery_code')).toBe('إشعار جديد');
  });
});
