import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEntryDto, CreateTargetDto } from '../bonus.module';

/**
 * F-069: a bonus entry or a sales target takes a "YYYY-MM" period. "2026-13"
 * or free text used to be stored, leaving a target no report could ever match.
 */
const UUID = '6c13a02b-9e59-4c31-b9cf-42f9a812df57';

const errorsOf = async (cls: new () => object, period: string) =>
  validate(
    plainToInstance(cls, { salesId: UUID, ruleId: UUID, amount: 10, amountTarget: 10, unitsTarget: 1, period }),
  );

describe.each([
  ['CreateTargetDto', CreateTargetDto],
  ['CreateEntryDto', CreateEntryDto],
])('%s period', (_name, cls) => {
  it.each(['2026-01', '2026-11', '2027-12'])('accepts %s', async (p) => {
    expect(await errorsOf(cls, p)).toHaveLength(0);
  });
  it.each(['2026-13', '2026-00', '2026-1', '26-11', 'next month', '2026-11-01', ''])('rejects "%s"', async (p) => {
    const errors = await errorsOf(cls, p);
    expect(errors.map((e) => e.property)).toContain('period');
  });
});
