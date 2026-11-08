import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { isCalendarDay } from '../calendar-day';
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
