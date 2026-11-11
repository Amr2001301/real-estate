import { autofillAmenityIcons, autofillFaqs, autofillSections, iconFor, type AutofillInput } from './project-autofill';

const t = (ar: string, en = ar) => ({ ar, en });
const base: AutofillInput = {
  name: t('حي النخيل', 'Palm District'),
  city: 'الرياض',
  district: 'النرجس',
  type: 'RESIDENTIAL',
  totalArea: 120_000,
  licenseNumber: 'L-77',
  units: [
    { type: '2BR', typeName: t('شقة غرفتين', 'Two-bedroom'), area: 95, available: true },
    { type: '2BR', typeName: t('شقة غرفتين', 'Two-bedroom'), area: 156, available: false },
    { type: 'Villa', typeName: t('فيلا', 'Villa'), area: 320, available: true },
  ],
  phases: [{ name: t('المرحلة 1', 'Phase 1'), deliveryDate: new Date('2027-09-01T00:00:00Z') }],
  plans: { minDownPaymentPercent: 10, maxMonths: 84, hasCash: true },
  amenities: [{ name: t('حمام سباحة', 'Pool'), icon: 'pool', group: 'INSIDE' }],
};

describe('project page autofill', () => {
  it('writes sections only from recorded facts', () => {
    const s = autofillSections(base);
    expect(s.map((x) => x.title.ar)).toEqual(['الموقع', 'تفاصيل المشروع', 'الوحدات والمساحات']);
    expect(s[0]!.body.ar).toBe('يقع حي النخيل في النرجس، الرياض.');
    expect(s[1]!.body.ar).toBe('نوع المشروع: سكني\nالمساحة الإجمالية: 120,000 م²\nعدد الوحدات: 3\nرقم الترخيص: L-77');
    expect(s[2]!.body.ar).toBe('شقة غرفتين: من 95 إلى 156 م²\nفيلا: 320 م²');
  });

  it('answers each ready question from the record', () => {
    const f = autofillFaqs(base);
    expect(f.map((x) => x.answer.ar)).toEqual([
      'في النرجس، الرياض.',
      'شقة غرفتين: 95 م²\nفيلا: 320 م²',
      'مقدم يبدأ من 10% وتقسيط حتى 7 سنوات، ويتوفر الدفع الكاش.',
      'موعد الاستلام المحدد: سبتمبر 2027.',
      'يضم حي النخيل: حمام سباحة.',
    ]);
  });

  it('leaves out what has no data behind it — never a guess', () => {
    const bare: AutofillInput = { ...base, district: null, type: null, totalArea: null, licenseNumber: null, units: [], phases: [], plans: { minDownPaymentPercent: null, maxMonths: null, hasCash: false }, amenities: [] };
    expect(autofillSections(bare).map((x) => x.title.ar)).toEqual(['الموقع']);
    expect(autofillFaqs(bare).map((x) => x.question.ar)).toEqual(['أين يقع حي النخيل؟']);
  });

  it('picks an icon from the amenity name, and keeps a chosen one', () => {
    expect(iconFor(t('مواقف خاصة', 'Private parking'))).toBe('parking');
    expect(iconFor(t('ملعب جولف', 'Golf course'))).toBe('sports');
    expect(iconFor(t('إطلالة بحرية', 'Sea view'))).toBe('sea');
    expect(iconFor(t('شيء آخر', 'Something'))).toBeNull();
    expect(
      autofillAmenityIcons([
        { name: t('نادي صحي', 'Gym'), icon: 'check', group: 'INSIDE' },
        { name: t('حدائق', 'Gardens'), icon: 'star', group: 'INSIDE' },
      ]).map((a) => a.icon),
    ).toEqual(['gym', 'star']);
  });
});
