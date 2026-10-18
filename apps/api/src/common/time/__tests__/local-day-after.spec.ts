import { localDayAfter } from '../company-timezone';
import { feeDueDate } from '../../../modules/installments/fee-settings';

// A due date is a day — UTC midnight of the company's calendar date — never
// the time a fee or row was written (Y1).
describe('localDayAfter / feeDueDate', () => {
  it('is the company-local day, at UTC midnight, the given days later', () => {
    // 22:30 UTC on 18 Oct is already 19 Oct in Cairo (UTC+3).
    const now = new Date('2026-10-18T22:30:00Z');
    expect(localDayAfter('Africa/Cairo', 7, now).toISOString()).toBe('2026-10-26T00:00:00.000Z');
    expect(localDayAfter('UTC', 7, now).toISOString()).toBe('2026-10-25T00:00:00.000Z');
  });

  it('a fee charged by the 01:00 late-fee job is due on a day, not at 01:00', () => {
    const charged = new Date('2026-10-18T01:00:00Z');
    expect(feeDueDate(charged, 14, 'Africa/Cairo').toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });
});
