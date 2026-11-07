/**
 * The customer account's statuses, notification titles and card labels read from
 * messages/account.ts. Both languages carry the same keys and the English one
 * has no Arabic letters.
 */
import { accountT } from '../messages/account';
import { notificationTitle } from '../lib/notification-title';

function shape(v: unknown, path = ''): string[] {
  if (typeof v === 'function') return [path];
  if (v && typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>).flatMap(([k, x]) => shape(x, path ? `${path}.${k}` : k));
  }
  return [path];
}

describe('account messages', () => {
  it('Arabic and English have the same keys', () => {
    expect(shape(accountT('en')).sort()).toEqual(shape(accountT('ar')).sort());
  });

  it('no English string contains Arabic letters', () => {
    const en = accountT('en');
    expect(JSON.stringify(en)).not.toMatch(/[؀-ۿ]/);
    expect(en.reservation.number('R-1')).toBe('Reservation R-1');
    expect(en.property.months('60')).toBe('60 months');
  });

  it('notification titles: the server title wins, then the language\'s label, then a generic one', () => {
    expect(notificationTitle('visit_scheduled', 'Tuesday 10:00', 'en')).toBe('Tuesday 10:00');
    expect(notificationTitle('visit_scheduled', undefined, 'en')).toBe('Your visit was scheduled');
    expect(notificationTitle('visit_scheduled', undefined, 'ar')).toBe('تم جدولة زيارتك');
    expect(notificationTitle('something_new', undefined, 'en')).toBe('New notification');
  });
});
