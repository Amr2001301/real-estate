import { mergeCustomValues, type FieldDef } from '../custom-values';
import { keyFromLabel } from '../customer-fields.service';

const f = (key: string, type: string, extra: Partial<FieldDef> = {}): FieldDef => ({
  key,
  type,
  options: [],
  active: true,
  label: { ar: key, en: key },
  ...extra,
});

const FIELDS = [
  f('spouse', 'TEXT'),
  f('kind', 'SELECT', { options: ['فرد', 'شركة'] }),
  f('children', 'NUMBER'),
  f('married', 'DATE'),
  f('old', 'TEXT', { active: false }),
];

describe('mergeCustomValues', () => {
  it('stores each value in its type and keeps what was not sent', () => {
    expect(
      mergeCustomValues(FIELDS, { old: 'kept', spouse: 'a' }, { kind: ' شركة ', children: '2', married: '2015-09-01' }),
    ).toEqual({ old: 'kept', spouse: 'a', kind: 'شركة', children: 2, married: '2015-09-01' });
  });

  it('clears on null or an empty value', () => {
    expect(mergeCustomValues(FIELDS, { spouse: 'a', children: 2 }, { spouse: '', children: null })).toEqual({});
  });

  it('leaves a field turned off as it is', () => {
    expect(mergeCustomValues(FIELDS, { old: 'kept' }, { old: 'new' })).toEqual({ old: 'kept' });
  });

  it.each([
    [{ kind: 'جمعية' }],
    [{ children: 'x' }],
    [{ married: '2015-02-30' }],
    [{ married: '01/09/2015' }],
    [{ spouse: 'x'.repeat(301) }],
    [{ spouse: { nested: true } }],
    [{ unknown: 'x' }],
  ])('refuses %j', (input) => {
    expect(() => mergeCustomValues(FIELDS, null, input)).toThrow();
  });

  it('ignores stored junk that is not a value', () => {
    expect(mergeCustomValues(FIELDS, { spouse: 'a', bad: { x: 1 } }, {})).toEqual({ spouse: 'a' });
    expect(mergeCustomValues(FIELDS, ['x'], {})).toEqual({});
  });
});

describe('keyFromLabel', () => {
  it.each([
    ['Spouse name', 'spouse_name'],
    ['  Work / Phone #2 ', 'work_phone_2'],
    ['2nd phone', 'nd_phone'],
    ['اسم', ''],
    ['x'.repeat(60), 'x'.repeat(40)],
  ])('%s → %s', (label, key) => {
    expect(keyFromLabel(label)).toBe(key);
  });
});
