import { callResultOf, leadStageOf, noteKindOf, normalizeWord, projectStatusOf, unitStatusOf } from '../migration-values';
import { codeFrom, slugOf } from '../data-migration.service';

describe('migration values', () => {
  it('matches words whatever their case, spacing or Arabic letter form', () => {
    expect(normalizeWord(' Closed_Won ')).toBe('closedwon');
    expect(normalizeWord('زيارة')).toBe(normalizeWord('زياره'));
    expect(leadStageOf('Closed Won')).toBe('WON');
    expect(leadStageOf('مهتم')).toBe('INTERESTED');
    expect(leadStageOf('NEGOTIATION')).toBe('NEGOTIATION');
    expect(leadStageOf('something else')).toBeUndefined();
    expect(leadStageOf(undefined)).toBeUndefined();
  });

  it('knows activity kinds, call results, project and unit statuses', () => {
    expect(noteKindOf('WhatsApp')).toBe('WHATSAPP');
    expect(noteKindOf('مكالمة')).toBe('CALL');
    expect(callResultOf('لم يرد')).toBe('NO_ANSWER');
    expect(callResultOf('wrong-number')).toBe('WRONG_NUMBER');
    expect(projectStatusOf('active')).toBe('PUBLISHED');
    expect(unitStatusOf('محجوز')).toBe('TAKEN');
    expect(unitStatusOf('Available')).toBe('AVAILABLE');
  });

  it('makes codes and slugs that this system accepts', () => {
    expect(codeFrom('proj_12', 'P')).toBe('PROJ-12');
    expect(codeFrom('مشروع', 'P')).toMatch(/^P-[0-9A-F]{8}$/);
    expect(slugOf('Salesforce CRM')).toBe('salesforce-crm');
    expect(slugOf('إنجاز')).toBe('');
  });
});
