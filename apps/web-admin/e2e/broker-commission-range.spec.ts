import { expect, test } from '@playwright/test';
import { brokerCommissionRange } from '../src/lib/broker-commission-range';

// QA run 1, F-040: the portal home showed the firm's default rate («2.50%») while the
// granted project locked 3%; with no default it showed «0.00%».
const grant = (commissionPct: string | number | null, active = true) => ({ access: { commissionPct, active } }) as never;

test.describe('brokerCommissionRange()', () => {
  test('one granted rate is shown as it is, the default is not', () => {
    expect(brokerCommissionRange([grant('3.00')], '2.50')).toBe('3%');
  });

  test('several rates show the range', () => {
    expect(brokerCommissionRange([grant(3), grant('2.5'), grant(4)], null)).toBe('2.5% – 4%');
  });

  test('an ended grant is ignored; with none left the firm default applies', () => {
    expect(brokerCommissionRange([grant(3, false)], '2.5')).toBe('2.5%');
  });

  test('no rate at all shows nothing — never 0.00%', () => {
    expect(brokerCommissionRange([], null)).toBeNull();
    expect(brokerCommissionRange([grant(null)], '0')).toBeNull();
  });
});
