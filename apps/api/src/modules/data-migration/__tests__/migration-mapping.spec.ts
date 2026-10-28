import { MigrationEntity } from '@prisma/client';
import { MappingTable, mappingValue, parseExtraField, type SavedMapping } from '../migration-mapping';

describe('MG2 mapping', () => {
  const row = (r: Partial<SavedMapping>): SavedMapping => ({
    field: 'LEAD.stage',
    value: mappingValue('مهتم جداً'),
    action: 'MAP',
    target: 'INTERESTED',
    companyId: null,
    ...r,
  });

  it('keys a value the way the import reads it: diacritics, tatweel, case and spaces ignored', () => {
    expect(mappingValue('مهتم جداً')).toBe(mappingValue('مهتم  جدا'));
    expect(mappingValue('مهتـــم')).toBe(mappingValue('مهتم'));
    expect(mappingValue('Facebook Ads')).toBe(mappingValue('facebook-ads'));
  });

  it('finds a value written another way, and a company’s own choice wins over the system-wide one', () => {
    const table = new MappingTable([
      row({ companyId: 'company-1', target: 'VISIT' }),
      row({}),
      row({ field: 'LEAD.extra.اسم الزوج', value: '', action: 'NOTE', target: null, companyId: 'company-1' }),
    ]);
    expect(table.of('LEAD.stage', 'مهتم جدا')?.target).toBe('VISIT');
    expect(table.of('LEAD.stage', 'something else')).toBeUndefined();
    expect(table.extra(MigrationEntity.LEAD, 'اسم الزوج')?.action).toBe('NOTE');
    expect(table.extra(MigrationEntity.CUSTOMER, 'اسم الزوج')).toBeUndefined();
  });

  it('reads an extra field key, and refuses anything else', () => {
    expect(parseExtraField('CUSTOMER.extra.المحافظة')).toEqual({ entity: MigrationEntity.CUSTOMER, key: 'المحافظة' });
    expect(parseExtraField('LEAD.stage')).toBeNull();
    expect(parseExtraField('NOPE.extra.x')).toBeNull();
  });
});
