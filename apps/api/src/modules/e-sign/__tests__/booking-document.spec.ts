import { pickForm, pickTemplate, reservationSnapshot } from '../document/booking-document';

/**
 * The booking form the customer signs, laid out by the API (it used to be
 * the dashboard's). Checked against the dashboard's printing code when it was
 * moved: same inputs, same document, in Arabic and English.
 */
const booking = {
  reservationNumber: 'RSV-2026-0042',
  createdAt: '2026-10-20T09:30:00.000Z',
  expiresAt: '2026-10-27T09:30:00.000Z',
  bookingAmount: '50000.5',
  selectedDurationMonths: 84,
  snapshotDownPaymentAmount: '300000',
  snapshotFinancedAmount: null,
  snapshotMonthlyInstallment: '14285.71',
  snapshotTotalPayable: '1500000',
  client: {
    fullName: 'منى أحمد',
    phone: '+201001234567',
    nationalId: '29001011234567',
    address: null,
    birthDate: '1990-05-17T00:00:00.000Z',
    customFields: { salary: 25000 },
  },
  lead: null,
  unit: {
    code: 'A-101',
    type: 'APARTMENT',
    area: '145.5',
    floor: 3,
    building: {
      name: { ar: 'مبنى أ', en: 'Building A' },
      phase: { project: { name: { ar: 'مشروع النيل', en: 'Nile Project' } } },
    },
  },
};
const letterhead = {
  name: 'Acme',
  displayName: 'أكمي',
  registrationNumber: 'CR-9',
  currency: 'EGP',
};
const paper = { signatoryName: 'م. خالد', signatoryTitle: null };
const fields = [
  { key: 'salary', label: { ar: 'الراتب', en: 'Salary' }, type: 'NUMBER' as const, active: true },
];
const templates = [
  { id: 't0', variant: 'CASH' as const, body: 'cash', isDefault: true },
  {
    id: 't1',
    variant: 'ANY' as const,
    isDefault: true,
    body: '## {{company.name}}\n{{customer.name}} — {{reservation.amountWords}}\n\n{{customer.birthDate}} {{custom.salary}} {{customer.address}}',
  },
];
const forms = [
  {
    id: 'f',
    isDefault: true,
    pages: [{ imageUrl: 'https://x/p1.png' }],
    fields: [
      {
        id: 'a',
        key: 'unit.project',
        page: 0,
        x: 0,
        y: 0,
        w: 0.3,
        h: 0.03,
        size: 12,
        align: 'start' as const,
      },
      {
        id: 'b',
        key: 'sign.customer',
        page: 0,
        x: 0,
        y: 0.8,
        w: 0.3,
        h: 0.1,
        size: 10,
        align: 'center' as const,
      },
    ],
  },
];

describe('booking form for signing', () => {
  it('lays out the customer, the unit, the amounts and the wording (Arabic)', () => {
    const doc = reservationSnapshot(
      booking,
      letterhead,
      paper,
      pickTemplate(templates),
      'ar',
      fields,
      null,
    );
    expect(doc).toMatchObject({
      version: 1,
      locale: 'ar',
      title: 'نموذج حجز وحدة عقارية',
      reference: 'RSV-2026-0042',
    });
    expect(doc.company).toEqual({
      name: 'أكمي',
      logoUrl: null,
      primaryColor: null,
      accentColor: null,
      registration: 'CR-9',
      phone: null,
    });
    expect(doc.sections[0]!.rows).toEqual([
      { label: 'الاسم', value: 'منى أحمد' },
      { label: 'الرقم القومي', value: '29001011234567' },
      { label: 'الهاتف', value: '+201001234567' },
    ]);
    expect(doc.sections[1]!.rows).toContainEqual({ label: 'المشروع', value: 'مشروع النيل' });
    expect(doc.sections[1]!.rows).toContainEqual({ label: 'المساحة', value: '145.5 م²' });
    expect(doc.amounts.map((a) => a.label)).toEqual([
      'مبلغ الحجز (العربون)',
      'الدفعة الأولى',
      'مدة السداد',
      'القسط الشهري',
      'إجمالي المبلغ المستحق',
    ]);
    expect(doc.amounts[0]!.value).toContain('50,000.50');
    expect(doc.amounts[2]!.value).toBe('84 شهر');
    expect(doc.clauses[0]).toEqual({ kind: 'heading', text: 'أكمي' });
    expect(doc.clauses[1]).toEqual({
      kind: 'paragraph',
      lines: ['منى أحمد — فقط خمسون ألف جنيه مصري وخمسون قرش لا غير'],
    });
    // A day reads in UTC; a value the record lacks is a dotted blank.
    expect(doc.clauses[2]).toEqual({ kind: 'paragraph', lines: ['17‏/05‏/1990 25,000 …………………'] });
    expect(doc.form).toBeUndefined();
  });

  it('English wording, and the company paper form with an empty signature box', () => {
    const doc = reservationSnapshot(
      booking,
      letterhead,
      paper,
      pickTemplate(templates),
      'en',
      fields,
      pickForm(forms),
    );
    expect(doc.title).toBe('Unit Reservation Form');
    expect(doc.sections[1]!.rows).toContainEqual({ label: 'Project', value: 'Nile Project' });
    expect(doc.amounts[2]!.value).toBe('84 months');
    expect(doc.clauses[1]).toEqual({
      kind: 'paragraph',
      lines: ['منى أحمد — Only fifty thousand Egyptian pounds and fifty piastres'],
    });
    expect(doc.form!.fields).toEqual([
      expect.objectContaining({ key: 'unit.project', text: 'Nile Project' }),
      expect.objectContaining({ key: 'sign.customer', image: null }),
    ]);
  });

  it('a lead without an account, no plan and no wording', () => {
    const doc = reservationSnapshot(
      {
        ...booking,
        client: null,
        lead: { fullName: 'Ali', phone: '+201112223334' },
        selectedDurationMonths: null,
        snapshotDownPaymentAmount: null,
        snapshotMonthlyInstallment: null,
        snapshotTotalPayable: null,
      },
      { name: '', currency: 'EGP' },
      paper,
      pickTemplate([]),
      'ar',
    );
    expect(doc.company.name).toBe('الشركة');
    expect(doc.sections[0]!.rows).toEqual([
      { label: 'الاسم', value: 'Ali' },
      { label: 'الهاتف', value: '+201112223334' },
    ]);
    expect(doc.amounts).toHaveLength(1);
    expect(doc.clauses).toEqual([]);
  });
});
