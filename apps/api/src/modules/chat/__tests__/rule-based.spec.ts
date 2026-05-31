import { normalizeArabic, foldDigits } from '../providers/rule-based/normalize';
import {
  extractSlots,
  extractBudget,
  extractRooms,
  extractCity,
  extractPropertyType,
} from '../providers/rule-based/slots';
import { detectIntent, detectFaqTopic } from '../providers/rule-based/intents';
import { detectGuidedAction } from '../providers/rule-based/guided';
import { FAQ_ANSWERS } from '../providers/rule-based/responses';
import { RuleBasedChatProvider } from '../providers/rule-based.provider';
import type { AssistantOutput } from '../providers/chat-provider';
import {
  CatalogSearchTool,
  buildUnitQuery,
  toUnitCard,
  toProjectCard,
  formatPrice,
  MAX_CARDS,
  type CatalogFacets,
  type CatalogSearchResult,
} from '../providers/rule-based/catalog-search';
import type { Slots } from '../providers/rule-based/slots';
import {
  ConversionTool,
  type CreateInfoInput,
  type CreateVisitInput,
} from '../providers/rule-based/conversion';
import {
  parsePhone,
  parseName,
  parseConsent,
  parsePreferredDate,
  parseChoiceIndex,
} from '../providers/rule-based/contact-parse';

/** In-memory catalog tool: records the slots it was called with, returns canned cards. */
class FakeCatalogTool extends CatalogSearchTool {
  unitCalls: Slots[] = [];
  projectCalls: Slots[] = [];
  unitResult: CatalogSearchResult = { cards: [], total: 0 };
  projectResult: CatalogSearchResult = { cards: [], total: 0 };
  facetsValue: CatalogFacets = {
    cities: ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة'],
    types: ['شقة', 'فيلا', 'استوديو', 'دوبلكس'],
  };

  async searchUnits(slots: Slots): Promise<CatalogSearchResult> {
    this.unitCalls.push({ ...slots });
    return this.unitResult;
  }
  async searchProjects(slots: Slots): Promise<CatalogSearchResult> {
    this.projectCalls.push({ ...slots });
    return this.projectResult;
  }
  async getFacets(): Promise<CatalogFacets> {
    return this.facetsValue;
  }
}

/** In-memory conversion tool: records create calls, can be made to throw. */
class FakeConversionTool extends ConversionTool {
  infoCalls: CreateInfoInput[] = [];
  visitCalls: CreateVisitInput[] = [];
  unitProject: Record<string, string | null> = {};
  failNext = false;

  async createInfoRequest(input: CreateInfoInput): Promise<{ id: string }> {
    if (this.failNext) throw new Error('service down');
    this.infoCalls.push(input);
    return { id: `info-${this.infoCalls.length}` };
  }
  async createVisitRequest(input: CreateVisitInput): Promise<{ id: string }> {
    if (this.failNext) throw new Error('service down');
    this.visitCalls.push(input);
    return { id: `visit-${this.visitCalls.length}` };
  }
  async resolveUnitProjectId(unitId: string): Promise<string | null> {
    return this.unitProject[unitId] ?? null;
  }
}

describe('normalizeArabic', () => {
  it('folds Arabic-Indic and Persian digits to ASCII', () => {
    expect(foldDigits('٣ غرف ۲۵۰')).toBe('3 غرف 250');
  });

  it('strips tashkeel and unifies alef / ta-marbuta / alef-maqsura', () => {
    expect(normalizeArabic('شَقَّة')).toBe('شقه');
    expect(normalizeArabic('أبحث')).toBe('ابحث');
    expect(normalizeArabic('مُستشَفى')).toContain('مستشفي');
  });
});

describe('slot extraction', () => {
  it('extracts property type from synonyms', () => {
    expect(extractPropertyType(normalizeArabic('عايز فيلا'))).toBe('villa');
    expect(extractPropertyType(normalizeArabic('شقة صغيرة'))).toBe('apartment');
    expect(extractPropertyType(normalizeArabic('استوديو'))).toBe('studio');
  });

  it('matches multi-word cities before substrings, returns proper orthography', () => {
    expect(extractCity(normalizeArabic('في الشيخ زايد'))).toBe('الشيخ زايد');
    // user may type without hamza/ta-marbuta; we still return the proper label
    expect(extractCity(normalizeArabic('في العاصمه الاداريه'))).toBe('العاصمة الإدارية');
  });

  it('reads rooms as a number or Arabic dual', () => {
    expect(extractRooms(normalizeArabic('٣ غرف'))).toBe(3);
    expect(extractRooms(normalizeArabic('غرفتين'))).toBe(2);
  });

  it('reads budget with million/thousand multipliers and money cues', () => {
    expect(extractBudget(normalizeArabic('ميزانيتي ٢ مليون'))).toBe(2_000_000);
    expect(extractBudget(normalizeArabic('في حدود 500 ألف'))).toBe(500_000);
    // bare number without a money cue must NOT be read as budget
    expect(extractBudget(normalizeArabic('3 غرف'))).toBeUndefined();
  });

  it('pulls several slots from one sentence', () => {
    const slots = extractSlots(normalizeArabic('عايز شقة في المعادي ٣ غرف بحدود ٢ مليون'));
    expect(slots).toMatchObject({
      propertyType: 'apartment',
      city: 'المعادي',
      minRooms: 3,
      budgetMax: 2_000_000,
    });
  });
});

describe('intent detection', () => {
  it('routes hand-off and transactional intents before search', () => {
    expect(detectIntent(normalizeArabic('محتاج اكلم مستشار'))).toBe('human_help');
    expect(detectIntent(normalizeArabic('ابعتلي على واتساب'))).toBe('whatsapp_handoff');
    expect(detectIntent(normalizeArabic('عايز احجز معاينة'))).toBe('request_visit');
  });

  it('detects FAQ, projects, units, and greeting', () => {
    expect(detectIntent(normalizeArabic('في تقسيط؟'))).toBe('ask_faq');
    expect(detectFaqTopic(normalizeArabic('عايز اعرف المقدم'))).toBe('installments');
    expect(detectIntent(normalizeArabic('ايه المشاريع المتاحة'))).toBe('search_projects');
    expect(detectIntent(normalizeArabic('بدور على شقة'))).toBe('search_units');
    expect(detectIntent(normalizeArabic('السلام عليكم'))).toBe('greeting');
  });

  it('treats a known city as a search, and an unrecognized token only inside an active search', () => {
    // a known city is itself a search (bare "جدة" starts the guided flow)
    expect(detectIntent(normalizeArabic('جدة'), false)).toBe('search_units');
    // an unrecognized token is a slot answer only when a search is already active
    expect(detectIntent(normalizeArabic('أي حاجة'), true)).toBe('search_units');
    expect(detectIntent(normalizeArabic('أي حاجة'), false)).toBe('unknown');
  });
});

describe('RuleBasedChatProvider (no LLM, no external calls)', () => {
  let catalog: FakeCatalogTool;
  let conversion: FakeConversionTool;
  let provider: RuleBasedChatProvider;
  const turn = (userMessage: string, context: AssistantOutput['context'] | null = null) =>
    provider.generateReply({ locale: 'ar', messages: [], userMessage, context });

  beforeEach(() => {
    catalog = new FakeCatalogTool();
    conversion = new FakeConversionTool();
    provider = new RuleBasedChatProvider(catalog, conversion);
  });

  it('greets with home quick replies and zero tokens', async () => {
    const out = await turn('مرحبا');
    expect(out.content).toContain('ديفورا');
    expect(out.quickReplies?.length).toBeGreaterThan(0);
    expect(out.tokensIn).toBe(0);
    expect(out.tokensOut).toBe(0);
    expect(out.cards).toEqual([]);
  });

  it('drives a multi-turn slot-filling search then runs the catalog search', async () => {
    catalog.unitResult = {
      total: 2,
      cards: [
        { type: 'unit', id: 'u1', title: 'شقة', price: '1,000,000 ج.م', href: '/units/u1' },
        { type: 'unit', id: 'u2', title: 'شقة', price: '1,200,000 ج.م', href: '/units/u2' },
      ],
    };
    // Turn 1: type given, city missing → asks for city, marks it pending.
    const t1 = await turn('عايز شقة');
    expect(t1.missingFields).toContain('city');
    expect(t1.content).toBe('في أي منطقة أو مدينة تفضّل البحث؟');
    expect(catalog.unitCalls).toHaveLength(0); // not enough criteria yet

    // Turn 2: a bare city reply, carrying the prior context forward → search runs.
    const t2 = await turn('المعادي', t1.context);
    expect(catalog.unitCalls).toHaveLength(1);
    expect(catalog.unitCalls[0]).toMatchObject({ propertyType: 'apartment', city: 'المعادي' });
    expect(t2.missingFields).toEqual([]);
    expect(t2.cards).toHaveLength(2);
    expect(t2.content).toContain('شقة');
    expect(t2.content).toContain('المعادي');
    expect(t2.ctas?.some((c) => c.kind === 'whatsapp')).toBe(true);
    expect(t2.ctas?.some((c) => c.label === 'عرض المزيد')).toBe(true);
    // last-search state recorded in context for follow-ups
    expect((t2.context as { lastResultIds?: string[] }).lastResultIds).toEqual(['u1', 'u2']);
  });

  it('answers a curated FAQ without fabricating numbers, offers a human', async () => {
    const out = await turn('عندكم تقسيط؟');
    expect(out.content).toContain('تقسيط');
    expect(out.content).not.toMatch(/\d%/); // no invented percentages
    expect(out.ctas?.some((c) => c.action === 'whatsapp')).toBe(true);
  });

  it('hands off to a human with a prefilled WhatsApp message (no phone on server)', async () => {
    const out = await turn('عايز اكلم حد');
    const wa = out.ctas?.find((c) => c.kind === 'whatsapp');
    expect(wa).toBeDefined();
    expect(wa?.href).toBeUndefined(); // client builds wa.me from its own env
    expect((wa?.payload as { message?: string })?.message).toContain('المساعد العقاري');
  });

  it('falls back to a guided menu on an unrecognized message', async () => {
    const out = await turn('asdkjfh');
    expect(out.content).toContain('لم أفهم');
    expect(out.quickReplies?.length).toBeGreaterThan(0);
  });

  it('no-result for a city NOT in the catalog names the available cities', async () => {
    catalog.unitResult = { total: 0, cards: [] };
    const out = await turn('عايز شقة في المعادي'); // المعادي not in facets
    expect(catalog.unitCalls).toHaveLength(1);
    expect(out.cards).toEqual([]);
    expect(out.content).toContain('المدن المتاحة');
    expect(out.quickReplies).toContain('الرياض'); // real catalog cities, not noise
    expect(out.quickReplies).not.toContain('غيّر الميزانية');
    expect(out.missingFields).toEqual(['city']);
    expect(out.ctas?.some((c) => c.kind === 'whatsapp')).toBe(true);
  });

  it('no-result for a real city but tight criteria offers to widen, not repeat', async () => {
    catalog.unitResult = { total: 0, cards: [] };
    const out = await turn('عايز فيلا في جدة'); // جدة is in facets
    expect(out.content).toContain('عرض لك كل الوحدات');
    expect(out.quickReplies?.some((q) => q.includes('كل الوحدات في جدة'))).toBe(true);
    expect(out.ctas?.some((c) => c.kind === 'whatsapp')).toBe(true);
  });

  it('runs a project search and returns project cards', async () => {
    catalog.projectResult = {
      total: 1,
      cards: [{ type: 'project', id: 'p1', title: 'كمبوند', city: 'المعادي', href: '/projects/p1' }],
    };
    const out = await turn('ابحث عن مشروع في المعادي');
    expect(catalog.projectCalls).toHaveLength(1);
    expect(catalog.projectCalls[0]).toMatchObject({ city: 'المعادي' });
    expect(out.cards).toHaveLength(1);
    expect(out.cards?.[0]?.type).toBe('project');
    expect(out.content).toContain('المعادي');
  });

  it('maps all collected slots through to the unit search', async () => {
    catalog.unitResult = { total: 1, cards: [{ type: 'unit', id: 'u1', title: 'شقة', href: '/units/u1' }] };
    await turn('عايز شقة في المعادي ٣ غرف بحدود ٢ مليون');
    expect(catalog.unitCalls[0]).toMatchObject({
      propertyType: 'apartment',
      city: 'المعادي',
      minRooms: 3,
      budgetMax: 2_000_000,
    });
  });

  it('lets the user change one criterion mid-search and re-asks for it', async () => {
    catalog.unitResult = { total: 1, cards: [{ type: 'unit', id: 'u1', title: 'شقة', href: '/units/u1' }] };
    const t1 = await turn('عايز شقة في المعادي');
    expect(catalog.unitCalls).toHaveLength(1);

    const t2 = await turn('غيّر المدينة', t1.context);
    // no new search ran; we cleared city and re-asked for it
    expect(catalog.unitCalls).toHaveLength(1);
    expect(t2.missingFields).toEqual(['city']);
    expect((t2.context as { slots: { city?: string } }).slots.city).toBeUndefined();
  });
});

describe('FreeAI-3: FAQ detection + curated answers', () => {
  it('maps common Arabic phrases to the right FAQ topic', () => {
    expect(detectFaqTopic(normalizeArabic('ازاي احجز زيارة'))).toBe('visit_howto');
    expect(detectFaqTopic(normalizeArabic('ازاي اعرف معلومات'))).toBe('info_howto');
    expect(detectFaqTopic(normalizeArabic('الحجز ازاي'))).toBe('reservation');
    expect(detectFaqTopic(normalizeArabic('ينفع ادفع اونلاين؟'))).toBe('online_payment');
    expect(detectFaqTopic(normalizeArabic('في تقسيط؟'))).toBe('installments');
    expect(detectFaqTopic(normalizeArabic('العقد بيتعمل ازاي'))).toBe('contract');
    expect(detectFaqTopic(normalizeArabic('في صيانة بعد الشراء؟'))).toBe('maintenance');
    expect(detectFaqTopic(normalizeArabic('ازاي اضيف للمفضلة'))).toBe('favorites');
    expect(detectFaqTopic(normalizeArabic('ادخل حسابي ازاي'))).toBe('account_portal');
    expect(detectFaqTopic(normalizeArabic('رقم الموبايل بتاعكم'))).toBe('contact');
    expect(detectFaqTopic(normalizeArabic('الشروط والاحكام'))).toBe('terms');
    expect(detectFaqTopic(normalizeArabic('سياسة الخصوصية'))).toBe('privacy');
  });

  it('"عايز اعرف معلومات" is an info request, not a unit search', () => {
    expect(detectIntent(normalizeArabic('عايز اعرف معلومات'))).toBe('request_info');
    // a generic info ask without a type also avoids search
    expect(detectIntent(normalizeArabic('ابعتلي تفاصيل'))).toBe('request_info');
  });

  it('no-online-payment answer is safe (states payments are not online)', () => {
    expect(FAQ_ANSWERS.online_payment).toContain('لا يتم الدفع أونلاين');
    expect(FAQ_ANSWERS.payment).toContain('وليست أونلاين');
    expect(FAQ_ANSWERS.reservation).toContain('لا يتم الحجز أو الدفع أونلاين');
  });

  it('financing answer gives no financial advice and no hard numbers', () => {
    expect(FAQ_ANSWERS.installments).toContain('لا أقدّم استشارات مالية');
    expect(FAQ_ANSWERS.installments).not.toMatch(/\d+%/);
  });

  it('maintenance/account answers never expose private account data', () => {
    expect(FAQ_ANSWERS.maintenance).toContain('لا يمكنني الاطلاع على بيانات حسابك');
    expect(FAQ_ANSWERS.account_portal).toContain('لا يمكنني الوصول إلى بيانات حسابك');
  });
});

describe('FreeAI-3: provider FAQ + clarification + fallback behavior', () => {
  let catalog: FakeCatalogTool;
  let conversion: FakeConversionTool;
  let provider: RuleBasedChatProvider;
  const turn = (userMessage: string, context: AssistantOutput['context'] | null = null) =>
    provider.generateReply({ locale: 'ar', messages: [], userMessage, context });

  beforeEach(() => {
    catalog = new FakeCatalogTool();
    conversion = new FakeConversionTool();
    provider = new RuleBasedChatProvider(catalog, conversion);
  });

  it('answers a FAQ with a topic-appropriate quick reply and human CTA', async () => {
    const out = await turn('ينفع ادفع اونلاين؟');
    expect(out.content).toContain('لا يتم الدفع أونلاين');
    expect(out.cards).toEqual([]);
    expect(out.ctas?.some((c) => c.kind === 'whatsapp')).toBe(true);
    expect(out.quickReplies).toContain('تواصل مع مستشار');
  });

  it('asks one clarification question at a time and preserves earlier slots', async () => {
    const t1 = await turn('عايز شقة');
    expect(t1.missingFields).toEqual(['city']); // only one field asked
    expect((t1.context as { slots: { propertyType?: string } }).slots.propertyType).toBe('apartment');
    expect(t1.quickReplies?.length).toBeGreaterThan(0);
  });

  it('no-result keeps the last filters in context (cityIn + priceMax)', async () => {
    catalog.unitResult = { total: 0, cards: [] };
    const out = await turn('عايز فيلا في الجيزة بحدود ١ مليون'); // الجيزة not in facets
    expect(out.content).toContain('المدن المتاحة');
    const ctx = out.context as { lastSearchFilters?: { cityIn?: string[]; priceMax?: number } };
    expect(ctx.lastSearchFilters?.cityIn).toContain('الجيزة');
    expect(ctx.lastSearchFilters?.priceMax).toBe(1_000_000);
  });

  it('changing the budget clears only the budget slot', async () => {
    catalog.unitResult = { total: 1, cards: [{ type: 'unit', id: 'u1', title: 'شقة', href: '/units/u1' }] };
    const t1 = await turn('عايز شقة في المعادي بحدود ٢ مليون');
    const t2 = await turn('غيّر الميزانية', t1.context);
    expect(catalog.unitCalls).toHaveLength(1); // no re-search yet
    expect(t2.missingFields).toEqual(['budgetMax']);
    const slots = (t2.context as { slots: { city?: string; propertyType?: string; budgetMax?: number } }).slots;
    expect(slots.budgetMax).toBeUndefined(); // only budget cleared
    expect(slots.city).toBe('المعادي');
    expect(slots.propertyType).toBe('apartment');
  });

  it('appends an availability disclaimer to result summaries', async () => {
    catalog.unitResult = { total: 1, cards: [{ type: 'unit', id: 'u1', title: 'شقة', href: '/units/u1' }] };
    const out = await turn('عايز شقة في المعادي');
    expect(out.content).toContain('تأكيد التوفر');
  });

  it('unknown input offers a guided menu (quick replies) and no fabricated cards', async () => {
    const out = await turn('zzzzz qqq');
    expect(out.content).toContain('لم أفهم');
    expect(out.quickReplies?.length).toBeGreaterThan(0);
    expect(out.cards).toEqual([]);
  });
});

describe('catalog-search mappers (pure, no DB)', () => {
  it('maps slots to multi-value public unit filters (cityIn/typeIn), cheapest-first', () => {
    const q = buildUnitQuery({ city: 'جدة', propertyType: 'apartment', minRooms: 3, budgetMax: 2_000_000 });
    expect(q.cityIn).toContain('جدة'); // Arabic spelling
    expect(q.cityIn).toContain('Jeddah'); // + English spelling for the same city
    // apartment expands to bedroom-coded catalog types
    expect(q.typeIn).toEqual(expect.arrayContaining(['apartment', '1BR', '2BR', '3BR']));
    expect(q).toMatchObject({ bedrooms: 3, priceMax: 2_000_000, sort: 'price_asc', page: 1 });
    expect(q.pageSize).toBe(MAX_CARDS);
  });

  it('expands duplex to both casings (handles "Duplex")', () => {
    const q = buildUnitQuery({ city: 'الرياض', propertyType: 'duplex' });
    expect(q.typeIn).toEqual(expect.arrayContaining(['Duplex', 'duplex']));
    expect(q.cityIn).toEqual(expect.arrayContaining(['الرياض', 'Riyadh']));
  });

  it('shapes a unit card from the public serializer and omits private fields', () => {
    const card = toUnitCard({
      id: 'u1',
      code: 'A-101',
      type: 'apartment',
      area: 120,
      bedrooms: 3,
      bathrooms: 2,
      price: '2500000',
      coverImage: 'https://cdn/x.jpg',
      project: { id: 'p1', name: { ar: 'الواحة', en: 'Oasis' }, city: 'المعادي' },
      // private fields that must never surface on a card:
      ...({ ownerId: 'secret', costPrice: 999, internalNotes: 'x' } as Record<string, unknown>),
    });
    expect(card).toEqual({
      type: 'unit',
      id: 'u1',
      title: 'شقة • A-101',
      subtitle: 'الواحة',
      price: '2,500,000 ج.م',
      area: 120,
      bedrooms: 3,
      bathrooms: 2,
      city: 'المعادي',
      imageUrl: 'https://cdn/x.jpg',
      href: '/units/u1',
    });
    // the discriminated card type has no place for these — proven by the exact equality above
    expect(JSON.stringify(card)).not.toContain('secret');
  });

  it('shapes a project card and never invents an availability count', () => {
    const card = toProjectCard({
      id: 'p1',
      name: { ar: 'الواحة', en: 'Oasis' },
      city: 'المعادي',
      coverImage: null,
      availableUnitsCount: 4,
    });
    expect(card).toEqual({
      type: 'project',
      id: 'p1',
      title: 'الواحة',
      subtitle: '4 وحدة متاحة',
      city: 'المعادي',
      imageUrl: null,
      href: '/projects/p1',
    });
  });

  it('formatPrice never fabricates a price for missing/invalid values', () => {
    expect(formatPrice(null)).toBeUndefined();
    expect(formatPrice(0)).toBeUndefined();
    expect(formatPrice('2500000')).toBe('2,500,000 ج.م');
  });
});

describe('FreeAI-4: contact/answer parsers (pure)', () => {
  it('normalizes Egyptian and international phones, rejects junk', () => {
    expect(parsePhone('01012345678')).toBe('+201012345678');
    expect(parsePhone('رقمي 0100 123 4567')).toBe('+201001234567');
    expect(parsePhone('+201234567890')).toBe('+201234567890');
    expect(parsePhone('مش فاكر')).toBeUndefined();
    expect(parsePhone('123')).toBeUndefined();
  });

  it('extracts a name from a prefix or a direct answer, rejects numbers', () => {
    expect(parseName('اسمي أحمد محمد')).toBe('أحمد محمد');
    expect(parseName('شقة', false)).toBeUndefined(); // no prefix, not asking
    expect(parseName('أحمد', true)).toBe('أحمد');
    expect(parseName('01012345678', true)).toBeUndefined();
  });

  it('reads consent as yes / no / unclear', () => {
    expect(parseConsent('نعم')).toBe('yes');
    expect(parseConsent('موافق')).toBe('yes');
    expect(parseConsent('لا')).toBe('no');
    expect(parseConsent('ممكن')).toBe('unclear');
  });

  it('parses relative and explicit dates, rejects unparseable', () => {
    const now = new Date('2026-05-26T09:00:00Z');
    expect(parsePreferredDate('بكرة', now)?.slice(0, 10)).toBe('2026-05-27');
    expect(parsePreferredDate('2026-06-15')).toContain('2026-06-15');
    expect(parsePreferredDate('مش عارف')).toBeUndefined();
  });

  it('parses a 1-based choice into a bounded index', () => {
    expect(parseChoiceIndex('2', 3)).toBe(1);
    expect(parseChoiceIndex('الأول', 3)).toBe(0);
    expect(parseChoiceIndex('9', 3)).toBeUndefined();
  });
});

describe('FreeAI-4: conversion flows (consent-gated lead capture)', () => {
  let catalog: FakeCatalogTool;
  let conversion: FakeConversionTool;
  let provider: RuleBasedChatProvider;
  const turn = (userMessage: string, context: AssistantOutput['context'] | null = null) =>
    provider.generateReply({ locale: 'ar', messages: [], userMessage, context });

  beforeEach(() => {
    catalog = new FakeCatalogTool();
    conversion = new FakeConversionTool();
    provider = new RuleBasedChatProvider(catalog, conversion);
  });

  // Helper: walk the info flow up to (but not through) the consent answer.
  async function infoUpToConsent() {
    const t1 = await turn('عايز معلومات');
    const t2 = await turn('اسمي أحمد', t1.context);
    const t3 = await turn('01012345678', t2.context);
    return t3; // now pending consent
  }

  it('info flow asks name → phone → consent, creating nothing before consent', async () => {
    const t1 = await turn('عايز معلومات');
    expect(t1.missingFields).toEqual(['name']);
    expect((t1.context as { conversion: { type: string; pending: string } }).conversion).toMatchObject({
      type: 'info',
      pending: 'name',
    });

    const t2 = await turn('اسمي أحمد', t1.context);
    expect(t2.missingFields).toEqual(['phone']);

    const t3 = await turn('01012345678', t2.context);
    expect(t3.missingFields).toEqual(['consent']);
    expect(t3.quickReplies).toContain('نعم');
    expect(conversion.infoCalls).toHaveLength(0); // nothing created yet
  });

  it('invalid phone re-asks and does not advance', async () => {
    const t1 = await turn('عايز معلومات');
    const t2 = await turn('اسمي أحمد', t1.context);
    const t3 = await turn('مش فاكر', t2.context);
    expect(t3.content).toContain('لا يبدو صحيحًا');
    expect(t3.missingFields).toEqual(['phone']);
    expect(conversion.infoCalls).toHaveLength(0);
  });

  it('creates the info request only after explicit consent', async () => {
    const pendingConsent = await infoUpToConsent();
    const done = await turn('نعم', pendingConsent.context);
    expect(conversion.infoCalls).toHaveLength(1);
    expect(conversion.infoCalls[0]).toMatchObject({ name: 'أحمد', phone: '+201012345678' });
    expect(conversion.infoCalls[0]?.message?.length).toBeGreaterThan(1);
    expect(done.content).toContain('تم استلام طلبك');
    expect(done.ctas?.some((c) => c.kind === 'whatsapp')).toBe(true);
    const ctx = done.context as { conversion: { done: boolean; createdRequestId: string } };
    expect(ctx.conversion.done).toBe(true);
    expect(ctx.conversion.createdRequestId).toBe('info-1');
  });

  it('explicit refusal creates nothing and ends the flow', async () => {
    const pendingConsent = await infoUpToConsent();
    const out = await turn('لا', pendingConsent.context);
    expect(conversion.infoCalls).toHaveLength(0);
    expect(out.content).toContain('لن أستخدم بياناتك');
    expect((out.context as { conversion: unknown }).conversion).toBeNull();
  });

  it('a backend failure returns a safe error and never fakes success', async () => {
    const pendingConsent = await infoUpToConsent();
    conversion.failNext = true;
    const out = await turn('نعم', pendingConsent.context);
    expect(conversion.infoCalls).toHaveLength(0);
    expect(out.content).toContain('تعذّر');
    expect(out.ctas?.some((c) => c.kind === 'whatsapp')).toBe(true);
    // flow stays open at consent so the user can retry
    expect((out.context as { conversion: { pending: string; done?: boolean } }).conversion).toMatchObject({
      pending: 'consent',
    });
  });

  it('visit flow without any property context sends the user to search first', async () => {
    const out = await turn('عايز احجز زيارة');
    expect(out.content).toBe(
      'لتحديد موعد زيارة، نحتاج أولًا اختيار المشروع أو الوحدة. ابحث الآن وسأكمل معك الحجز.',
    );
    expect(conversion.visitCalls).toHaveLength(0);
    expect((out.context as { conversion: unknown }).conversion).toBeNull();
  });

  it('visit flow asks the user to choose when several results exist', async () => {
    const ctx = { slots: {}, turnCount: 0, lastResultIds: ['p1', 'p2'], lastSearchIntent: 'search_projects' };
    const t1 = await turn('عايز احجز زيارة', ctx);
    expect(t1.content).toContain('اكتب رقمه');
    expect(t1.quickReplies).toEqual(['1', '2']);

    const t2 = await turn('1', t1.context); // pick project p1
    expect(t2.missingFields).toEqual(['preferredDate']);
  });

  it('auto-selects a single recent project result (skips the choose step)', async () => {
    const ctx = { slots: {}, turnCount: 0, lastResultIds: ['p1'], lastSearchIntent: 'search_projects' };
    const t1 = await turn('احجزلي معاينة', ctx);
    expect(t1.missingFields).toEqual(['preferredDate']);
  });

  it('completes a full visit flow and creates the request with a projectId', async () => {
    const ctx = { slots: {}, turnCount: 0, lastResultIds: ['p1'], lastSearchIntent: 'search_projects' };
    const t1 = await turn('احجزلي معاينة', ctx);
    const t2 = await turn('بكرة', t1.context);
    const t3 = await turn('اسمي سارة', t2.context);
    const t4 = await turn('01012345678', t3.context);
    expect(conversion.visitCalls).toHaveLength(0); // still no consent
    const done = await turn('نعم', t4.context);
    expect(conversion.visitCalls).toHaveLength(1);
    expect(conversion.visitCalls[0]).toMatchObject({
      projectId: 'p1',
      name: 'سارة',
      phone: '+201012345678',
    });
    expect(conversion.visitCalls[0]?.preferredDate).toContain('-');
    expect(done.content).toContain('تم تسجيل طلب الزيارة');
  });

  it('resolves a unit result to its project id for the visit request', async () => {
    conversion.unitProject['u1'] = 'p9';
    const ctx = { slots: {}, turnCount: 0, lastResultIds: ['u1'], lastSearchIntent: 'search_units' };
    const t1 = await turn('عايز احجز زيارة', ctx); // count 1 → asks to confirm choice
    const t2 = await turn('1', t1.context); // resolves u1 → p9
    expect(t2.missingFields).toEqual(['preferredDate']);
    const t3 = await turn('بكرة', t2.context);
    const t4 = await turn('اسمي علي', t3.context);
    const t5 = await turn('01012345678', t4.context);
    const done = await turn('نعم', t5.context);
    expect(conversion.visitCalls[0]).toMatchObject({ projectId: 'p9', unitId: 'u1' });
    expect(done.content).toContain('تم تسجيل');
  });

  it('cancel aborts the flow at any point', async () => {
    const t1 = await turn('عايز معلومات');
    const out = await turn('إلغاء', t1.context);
    expect(out.content).toContain('تم إلغاء الطلب');
    expect((out.context as { conversion: unknown }).conversion).toBeNull();
    expect(conversion.infoCalls).toHaveLength(0);
  });

  it('WhatsApp handoff returns a CTA payload, not an external call', async () => {
    const out = await turn('واتساب');
    const wa = out.ctas?.find((c) => c.kind === 'whatsapp');
    expect(wa).toBeDefined();
    expect(wa?.href).toBeUndefined();
    expect((wa?.payload as { message?: string })?.message?.length).toBeGreaterThan(1);
  });
});

describe('FreeAI polish: city/type recognition + smarter guided flow', () => {
  let catalog: FakeCatalogTool;
  let conversion: FakeConversionTool;
  let provider: RuleBasedChatProvider;
  const turn = (userMessage: string, context: AssistantOutput['context'] | null = null) =>
    provider.generateReply({ locale: 'ar', messages: [], userMessage, context });

  beforeEach(() => {
    catalog = new FakeCatalogTool();
    conversion = new FakeConversionTool();
    provider = new RuleBasedChatProvider(catalog, conversion);
  });

  it('recognizes "جده" as "جدة" (ta-marbuta variant)', () => {
    expect(extractCity(normalizeArabic('جده'))).toBe('جدة');
    expect(extractCity(normalizeArabic('عايز شقة في جده'))).toBe('جدة');
    expect(extractCity(normalizeArabic('مكه'))).toBe('مكة المكرمة');
  });

  it('a city answer advances to the next field and does NOT repeat the city question', async () => {
    const t1 = await turn('ابحث عن وحدة'); // search verb, no city → ask city
    expect(t1.missingFields).toEqual(['city']);
    expect(t1.quickReplies).toContain('الرياض'); // facet-driven chips

    const t2 = await turn('جده', t1.context); // bare city answer
    // advanced to TYPE (city saved), not re-asking the city
    expect(t2.missingFields).toEqual(['propertyType']);
    expect(t2.content).toContain('شقة، فيلا، استوديو');
    expect((t2.context as { slots: { city?: string } }).slots.city).toBe('جدة');
  });

  it('city + type is enough to search (one query) and renders cards', async () => {
    catalog.unitResult = { total: 2, cards: [
      { type: 'unit', id: 'u1', title: 'شقة', href: '/units/u1' },
      { type: 'unit', id: 'u2', title: 'شقة', href: '/units/u2' },
    ] };
    const out = await turn('شقة في جده');
    expect(catalog.unitCalls).toHaveLength(1);
    expect(catalog.unitCalls[0]).toMatchObject({ propertyType: 'apartment', city: 'جدة' });
    expect(out.cards).toHaveLength(2);
    // result cards have unique ids (defensive dedupe)
    const ids = (out.cards ?? []).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('result quick replies are context-aware (no budget chip before budget known)', async () => {
    catalog.unitResult = { total: 1, cards: [{ type: 'unit', id: 'u1', title: 'فيلا', href: '/units/u1' }] };
    const out = await turn('فيلا في الرياض'); // no budget given
    expect(out.quickReplies).not.toContain('غيّر الميزانية');
    expect(out.quickReplies).toContain('احجز زيارة');
  });

  it('"عرض كل الوحدات في جدة" drops the type filter and searches the city', async () => {
    catalog.unitResult = { total: 3, cards: [{ type: 'unit', id: 'u1', title: 'شقة', href: '/units/u1' }] };
    const out = await turn('عرض كل الوحدات في جدة');
    expect(catalog.unitCalls).toHaveLength(1);
    expect(catalog.unitCalls[0]?.city).toBe('جدة');
    expect(catalog.unitCalls[0]?.propertyType).toBeUndefined();
    expect(out.cards?.length).toBeGreaterThan(0);
  });
});

describe('FreeAI guided assistant: generalized vague-input handling', () => {
  let catalog: FakeCatalogTool;
  let conversion: FakeConversionTool;
  let provider: RuleBasedChatProvider;
  const turn = (userMessage: string, context: AssistantOutput['context'] | null = null) =>
    provider.generateReply({ locale: 'ar', messages: [], userMessage, context });

  beforeEach(() => {
    catalog = new FakeCatalogTool();
    conversion = new FakeConversionTool();
    provider = new RuleBasedChatProvider(catalog, conversion);
  });

  it('maps vague/help phrases to broad guided actions (not exact matches)', () => {
    expect(detectGuidedAction(normalizeArabic('مش عارف'))).toBe('HELP_ME_CHOOSE');
    expect(detectGuidedAction(normalizeArabic('اختارلي اللي يناسبني'))).toBe('HELP_ME_CHOOSE');
    expect(detectGuidedAction(normalizeArabic('رشحلي'))).toBe('RECOMMEND');
    expect(detectGuidedAction(normalizeArabic('اي المناطق المتاحه'))).toBe('SHOW_AVAILABLE_CITIES');
    expect(detectGuidedAction(normalizeArabic('الانواع المتاحه'))).toBe('SHOW_AVAILABLE_TYPES');
    expect(detectGuidedAction(normalizeArabic('عرض كل المتاح'))).toBe('SHOW_ALL_IN_CITY');
    expect(detectGuidedAction(normalizeArabic('بدون ميزانية'))).toBe('RELAX_BUDGET');
    expect(detectGuidedAction(normalizeArabic('ابدأ من جديد'))).toBe('START_OVER');
    expect(detectGuidedAction(normalizeArabic('شقة في جدة'))).toBeNull(); // concrete → not guided
  });

  it('"عايز مكتب في مكان حلو" keeps the office type and asks for a city with chips', async () => {
    const out = await turn('عايز مكتب في مكان حلو');
    expect(out.missingFields).toEqual(['city']);
    expect(out.quickReplies).toContain('الرياض'); // real catalog cities
    expect((out.context as { slots: { propertyType?: string } }).slots.propertyType).toBe('office');
  });

  it('"اي المناطق المتاحه" while city is pending shows city options (not the same question)', async () => {
    const t1 = await turn('ابحث عن وحدة'); // → ask city
    expect(t1.missingFields).toEqual(['city']);
    const t2 = await turn('اي المناطق المتاحه', t1.context);
    expect(t2.content).toContain('المدن المتاحة');
    expect(t2.content).not.toBe(t1.content);
    expect(t2.quickReplies).toContain('جدة');
  });

  it('"مش عارف" while type is pending shows the available types', async () => {
    const t1 = await turn('في جدة'); // city → ask type
    expect(t1.missingFields).toEqual(['propertyType']);
    const t2 = await turn('مش عارف', t1.context);
    expect(t2.content).toContain('الأنواع المتاحة');
    expect(t2.quickReplies && t2.quickReplies.length).toBeGreaterThan(0);
  });

  it('completes a search via a city chip then a type chip', async () => {
    catalog.unitResult = { total: 1, cards: [{ type: 'unit', id: 'u1', title: 'شقة', href: '/units/u1' }] };
    const t1 = await turn('ابحث عن وحدة');
    const t2 = await turn('جدة', t1.context); // city chip
    expect(t2.missingFields).toEqual(['propertyType']);
    const t3 = await turn('شقة', t2.context); // type chip → search
    expect(t3.cards).toHaveLength(1);
    expect(catalog.unitCalls.at(-1)).toMatchObject({ city: 'جدة', propertyType: 'apartment' });
  });

  it('"عرض كل المتاح في جدة" searches the city with the type dropped', async () => {
    catalog.unitResult = { total: 4, cards: [{ type: 'unit', id: 'u1', title: 'شقة', href: '/units/u1' }] };
    const out = await turn('عرض كل المتاح في جدة');
    expect(catalog.unitCalls).toHaveLength(1);
    expect(catalog.unitCalls[0]?.city).toBe('جدة');
    expect(catalog.unitCalls[0]?.propertyType).toBeUndefined();
    expect(out.cards?.length).toBeGreaterThan(0);
  });

  it('"ابدأ من جديد" clears guided search state and shows a fresh menu', async () => {
    catalog.unitResult = { total: 1, cards: [{ type: 'unit', id: 'u1', title: 'فيلا', href: '/units/u1' }] };
    const t1 = await turn('فيلا في الرياض'); // builds up slots + a search
    const out = await turn('ابدأ من جديد', t1.context);
    const ctx = out.context as { slots: Record<string, unknown>; lastResultIds?: string[] };
    expect(Object.keys(ctx.slots)).toHaveLength(0); // slots cleared
    expect(ctx.lastResultIds).toBeUndefined();
    expect(out.quickReplies).toContain('الرياض');
  });

  it('repeated unrecognized input escalates instead of repeating the same fallback', async () => {
    const t1 = await turn('asdkjfh');
    const t2 = await turn('qwerty zzz', t1.context);
    expect(t2.content).not.toBe(t1.content); // different message
    expect(t2.ctas?.some((c) => c.kind === 'whatsapp')).toBe(true); // offers a human
  });
});
