import { RISE_NOTICE_EVERY_MS, shouldNotifyRise } from './unit-value';

describe('shouldNotifyRise («ارتفعت قيمة وحدتك»)', () => {
  const now = new Date('2026-11-11T10:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it('first notice: only above the price paid by at least 1%', () => {
    expect(shouldNotifyRise({ purchasePrice: 1_000_000, currentValue: 1_010_000 }, null, now)).toBe(true);
    expect(shouldNotifyRise({ purchasePrice: 1_000_000, currentValue: 1_009_999 }, null, now)).toBe(false);
    expect(shouldNotifyRise({ purchasePrice: 1_000_000, currentValue: 900_000 }, null, now)).toBe(false);
  });

  it('after a notice: not within 30 days, then only for a further 1% rise', () => {
    const last = (value: number, msAgo: number) => ({ value, at: ago(msAgo) });
    expect(shouldNotifyRise({ purchasePrice: 1_000_000, currentValue: 1_500_000 }, last(1_100_000, RISE_NOTICE_EVERY_MS - 1), now)).toBe(false);
    expect(shouldNotifyRise({ purchasePrice: 1_000_000, currentValue: 1_105_000 }, last(1_100_000, RISE_NOTICE_EVERY_MS), now)).toBe(false);
    expect(shouldNotifyRise({ purchasePrice: 1_000_000, currentValue: 1_111_000 }, last(1_100_000, RISE_NOTICE_EVERY_MS), now)).toBe(true);
  });

  it('never when the value is back at or below the price paid', () => {
    expect(shouldNotifyRise({ purchasePrice: 1_000_000, currentValue: 1_000_000 }, { value: 900_000, at: ago(RISE_NOTICE_EVERY_MS * 2) }, now)).toBe(false);
  });
});
