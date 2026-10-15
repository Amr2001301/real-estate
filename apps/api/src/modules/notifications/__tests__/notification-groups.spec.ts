import { NOTIFICATION_CATALOG } from '../notification-catalog';
import { channelAllowed, notificationGroup, resolvePrefs } from '../notification-groups';

describe('notification groups', () => {
  it('files each event under the group a user would look for', () => {
    expect(notificationGroup('lead_stage_changed')).toBe('sales');
    expect(notificationGroup('reservation_expired')).toBe('sales');
    expect(notificationGroup('installment_overdue')).toBe('finance');
    expect(notificationGroup('cheque_status_changed')).toBe('finance');
    expect(notificationGroup('bonus_status_changed')).toBe('finance');
    expect(notificationGroup('maintenance_request_resolved')).toBe('maintenance');
    expect(notificationGroup('subscription_expiring_soon')).toBe('account');
    expect(notificationGroup('user_account_created')).toBe('account');
  });

  it('never silences an admin broadcast', () => {
    expect(notificationGroup('admin_broadcast')).toBeNull();
    expect(
      channelAllowed(
        { email: { sales: false }, push: { sales: false } },
        'push',
        'admin_broadcast',
      ),
    ).toBe(true);
  });

  it('every catalog event resolves to a group or is a broadcast', () => {
    for (const t of NOTIFICATION_CATALOG) {
      const g = notificationGroup(t.code);
      expect(g === null ? t.code : 'ok').toMatch(/^(ok|admin_broadcast)$/);
    }
  });

  it('defaults every channel on and honours only explicit opt-outs', () => {
    expect(resolvePrefs(null).email.finance).toBe(true);
    const prefs = resolvePrefs({ push: { finance: false }, email: { finance: 'nope' } });
    expect(prefs.push.finance).toBe(false);
    expect(prefs.email.finance).toBe(true);
    expect(channelAllowed({ push: { finance: false } }, 'push', 'installment_overdue')).toBe(false);
    expect(channelAllowed({ push: { finance: false } }, 'email', 'installment_overdue')).toBe(true);
  });
});
