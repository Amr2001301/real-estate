import { localHour, localTime } from '../follow-up-reminder.cron';

describe('follow-up reminder times', () => {
  const at = new Date('2026-10-28T07:05:00.000Z');

  it('reads the hour and time in the company zone', () => {
    expect(localHour('Africa/Cairo', at)).toBe(10);
    expect(localTime('Africa/Cairo', at)).toBe('10:05');
    expect(localHour('Asia/Riyadh', at)).toBe(10);
    expect(localTime('UTC', at)).toBe('07:05');
  });

  it('midnight is hour 0, not 24', () => {
    expect(localHour('UTC', new Date('2026-10-28T00:30:00.000Z'))).toBe(0);
  });
});
