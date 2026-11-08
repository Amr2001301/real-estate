import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { isCalendarDay } from '../calendar-day';
import { reportRange } from '../../time/report-range';
import { UpdateUserDto } from '../../../modules/users/dto/user.dto';
import { AddCampaignSpendDto, CreateCampaignDto } from '../../../modules/campaigns/dto/campaign.dto';

/** F-070: a day that does not exist used to be stored as the next month's. */
describe('isCalendarDay', () => {
  it.each(['2026-11-05', '2024-02-29', '2026-12-31', '2026-01-01'])('accepts %s', (v) => {
    expect(isCalendarDay(v)).toBe(true);
  });
  it.each(['2026-02-30', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-11-00', '2026-1-5', 'today', '', null, 20261105])(
    'rejects %s',
    (v) => {
      expect(isCalendarDay(v)).toBe(false);
    },
  );
});

describe('campaign DTO days', () => {
  it('rejects an impossible start day and spend day', async () => {
    const c = await validate(plainToInstance(CreateCampaignDto, { name: 'x', channel: 'GOOGLE', startDate: '2026-02-30' }));
    expect(c.map((e) => e.property)).toContain('startDate');
    const s = await validate(plainToInstance(AddCampaignSpendDto, { amount: 10, spentOn: '2026-02-30' }));
    expect(s.map((e) => e.property)).toContain('spentOn');
  });
  it('accepts real days', async () => {
    const c = await validate(plainToInstance(CreateCampaignDto, { name: 'x', channel: 'GOOGLE', startDate: '2026-11-01', endDate: '2026-11-30' }));
    expect(c).toHaveLength(0);
    const s = await validate(plainToInstance(AddCampaignSpendDto, { amount: 10, spentOn: '2026-11-05' }));
    expect(s).toHaveLength(0);
  });
});

describe('report range and customer record days (F-070 follow-up)', () => {
  it('reportRange refuses a day that does not exist, keeps real days and timestamps', () => {
    expect(() => reportRange('2026-02-30', undefined, 'Africa/Cairo')).toThrow('not a real date');
    expect(() => reportRange(undefined, '2026-04-31', 'Africa/Cairo')).toThrow('not a real date');
    expect(reportRange('2026-02-28', '2026-03-01', 'Africa/Cairo').gte).toBeInstanceOf(Date);
    expect(reportRange('2026-02-28T10:00:00Z', undefined, 'Africa/Cairo').gte).toBeInstanceOf(Date);
  });
  it('a customer record refuses an impossible birth date or ID issue date', async () => {
    const bad = await validate(plainToInstance(UpdateUserDto, { birthDate: '2026-02-30', nationalIdIssueDate: '2025-13-01' }));
    expect(bad.map((e) => e.property).sort()).toEqual(['birthDate', 'nationalIdIssueDate']);
    const ok = await validate(plainToInstance(UpdateUserDto, { birthDate: '1990-02-28', nationalIdIssueDate: '2020-02-29' }));
    expect(ok).toHaveLength(0);
  });
});
