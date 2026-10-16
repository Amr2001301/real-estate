import { BadRequestException } from '@nestjs/common';
import {
  LATE_FEE_DEFAULTS,
  LATE_FEE_VALIDATORS,
  type LateFeeSettings,
  lateFeesDue,
  resolveLateFeeSettings,
} from '../late-fee';

const DAY = 24 * 60 * 60 * 1000;
const due = new Date('2026-01-10T00:00:00Z');
const at = (days: number) => new Date(due.getTime() + days * DAY);
const on = (s: Partial<LateFeeSettings> = {}): LateFeeSettings => ({ ...LATE_FEE_DEFAULTS, enabled: true, ...s });
const inst = { amount: 10_000, dueDate: due };

describe('lateFeesDue', () => {
  it('charges nothing while switched off', () => {
    expect(lateFeesDue(inst, LATE_FEE_DEFAULTS, [], at(60))).toEqual([]);
  });

  it('waits out the grace period', () => {
    expect(lateFeesDue(inst, on(), [], at(6))).toEqual([]);
    expect(lateFeesDue(inst, on(), [], at(7))).toEqual([100]); // 1% of 10,000
  });

  it('charges a fixed amount once', () => {
    const s = on({ mode: 'FIXED', value: 250 });
    expect(lateFeesDue(inst, s, [], at(30))).toEqual([250]);
    expect(lateFeesDue(inst, s, [{ amount: 250, waived: false }], at(90))).toEqual([]);
  });

  it('repeats monthly and catches up missed months', () => {
    const s = on({ repeat: 'MONTHLY' });
    expect(lateFeesDue(inst, s, [], at(7 + 31 + 28 + 1))).toEqual([100, 100, 100]);
    expect(lateFeesDue(inst, s, [{ amount: 100, waived: false }], at(7 + 20))).toEqual([]);
  });

  it('never goes past the cap; the last fee is trimmed to it', () => {
    const s = on({ repeat: 'MONTHLY', maxPerInstallment: 250 });
    expect(lateFeesDue(inst, s, [], at(7 + 31 + 28 + 31 + 1))).toEqual([100, 100, 50]);
    expect(
      lateFeesDue(inst, s, [{ amount: 100, waived: false }, { amount: 100, waived: false }, { amount: 50, waived: false }], at(400)),
    ).toEqual([]);
  });

  it('a waived fee is not charged again, and does not count toward the cap', () => {
    const s = on({ repeat: 'MONTHLY', maxPerInstallment: 200 });
    // Period 1 waived, period 2 charged now: 100 of the 200 cap used.
    expect(lateFeesDue(inst, s, [{ amount: 100, waived: true }], at(7 + 31 + 1))).toEqual([100]);
    expect(lateFeesDue(inst, on(), [{ amount: 100, waived: true }], at(60))).toEqual([]);
  });

  it('rounds a percentage to the cent', () => {
    expect(lateFeesDue({ amount: 333.33, dueDate: due }, on({ value: 1.5 }), [], at(7))).toEqual([5]);
  });
});

describe('late-fee settings', () => {
  it('resolves stored values and falls back on malformed ones', () => {
    expect(
      resolveLateFeeSettings([
        { key: 'lateFee.enabled', value: true },
        { key: 'lateFee.mode', value: 'FIXED' },
        { key: 'lateFee.value', value: 'abc' },
      ]),
    ).toEqual({ ...LATE_FEE_DEFAULTS, enabled: true, mode: 'FIXED' });
  });

  it('rejects invalid values', () => {
    expect(() => LATE_FEE_VALIDATORS['lateFee.graceDays']!('lateFee.graceDays', -1)).toThrow(BadRequestException);
    expect(() => LATE_FEE_VALIDATORS['lateFee.mode']!('lateFee.mode', 'DAILY')).toThrow(BadRequestException);
    expect(() => LATE_FEE_VALIDATORS['lateFee.value']!('lateFee.value', 1.234)).toThrow(BadRequestException);
    expect(() => LATE_FEE_VALIDATORS['lateFee.repeat']!('lateFee.repeat', 'MONTHLY')).not.toThrow();
  });
});
