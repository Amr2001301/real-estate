import { Injectable } from '@nestjs/common';
import {
  ChatProvider,
  type AssistantCta,
  type AssistantOutput,
  type GenerateReplyInput,
} from './chat-provider';
import { normalizeArabic } from './rule-based/normalize';
import { detectIntent, detectFaqTopic, type Intent } from './rule-based/intents';
import { extractSlots, detectSlotReset, type SlotField, type Slots } from './rule-based/slots';
import { detectGuidedAction, type GuidedAction } from './rule-based/guided';
import { loadState, mergeSlots, type ChatState } from './rule-based/state';
import {
  CatalogSearchTool,
  buildProjectQuery,
  buildUnitQuery,
  type CatalogSearchResult,
} from './rule-based/catalog-search';
import {
  ConversionTool,
  type ConversionState,
  type ConversionStep,
  type ConversionType,
} from './rule-based/conversion';
import {
  isCancel,
  parseChoiceIndex,
  parseConsent,
  parseName,
  parsePhone,
  parsePreferredDate,
} from './rule-based/contact-parse';
import * as copy from './rule-based/responses';

const SEARCH_INTENTS: ReadonlySet<Intent> = new Set(['search_units', 'search_projects']);

/**
 * Free, deterministic real-estate assistant — NO LLM, NO external calls, NO
 * keys. Detects intent and extracts search criteria from normalized Arabic,
 * drives a guided slot-filling flow, runs the PUBLIC catalog search, returns
 * result cards, answers a curated FAQ, and offers conversion CTAs. Inline lead
 * capture (FreeAI-4) plugs into the visit/info CTAs.
 *
 * Stateless by design: it reads `input.context`, returns the next `context`,
 * and the ChatService persists it to ChatSession.metadata.
 */
@Injectable()
export class RuleBasedChatProvider extends ChatProvider {
  constructor(
    private readonly catalog: CatalogSearchTool,
    private readonly conversion: ConversionTool,
  ) {
    super();
  }

  async generateReply(input: GenerateReplyInput): Promise<AssistantOutput> {
    const state = loadState(input.context);
    state.turnCount += 1;

    const norm = normalizeArabic(input.userMessage);
    const incoming = extractSlots(norm);

    // An active lead-capture flow takes precedence: the next message answers the
    // field we last asked for (unless the user cancels).
    if (state.conversion && state.conversion.type && !state.conversion.done) {
      return this.handleConversion(state, norm, input.userMessage);
    }

    // Track consecutive unrecognized turns so the fallback escalates, never
    // repeats. Optimistically reset; only the unknown branch re-raises it.
    const priorUnknown = state.unknownStreak ?? 0;
    state.unknownStreak = 0;

    const hasActiveSearch = SEARCH_INTENTS.has((state.intent ?? 'unknown') as Intent);

    // During an active search, "غيّر الميزانية/المدينة" clears one slot and
    // re-asks instead of re-running the search with stale criteria.
    if (hasActiveSearch) {
      const reset = detectSlotReset(norm);
      if (reset) return this.askForReset(reset, state);
    }

    // "أكثر من ٥ مليون" while choosing budget → no upper cap (not a ≤ filter).
    if (state.pendingField === 'budgetMax' && /اكثر من|اكتر من/.test(norm)) {
      state.slots.budgetMax = undefined;
      state.intent = 'search_units';
      return this.routeSearch(state);
    }

    // Broad guided actions (vague/help language) → always respond with real
    // catalog options instead of a brittle phrase match or a dead end.
    const guided = detectGuidedAction(norm);
    if (guided) return this.handleGuided(guided, state, incoming);

    const intent = detectIntent(norm, hasActiveSearch);

    switch (intent) {
      case 'greeting':
        return this.reply(copy.GREETING_REPLY, state, { quickReplies: copy.HOME_QUICK_REPLIES });

      case 'human_help':
      case 'whatsapp_handoff':
        return this.reply(copy.HUMAN_HANDOFF, state, { ctas: [this.whatsappCta()] });

      case 'ask_faq':
        return this.handleFaq(norm, state);

      case 'request_visit':
        return this.startConversion('visit', state);

      case 'request_info':
        return this.startConversion('info', state);

      case 'compare_or_recommend':
        return this.startSearch('search_units', state, incoming, copy.COMPARE_GUIDE);

      case 'search_projects':
        return this.startSearch('search_projects', state, incoming);

      case 'search_units':
        return this.startSearch('search_units', state, incoming);

      default:
        return this.handleUnknown(state, priorUnknown);
    }
  }

  /** Route a broad guided action to real options, in the current context. */
  private async handleGuided(
    action: GuidedAction,
    state: ChatState,
    incoming: Slots,
  ): Promise<AssistantOutput> {
    // Fold in any concrete criteria the user did include (e.g. "مكتب في مكان حلو").
    state.slots = mergeSlots(state.slots, incoming);

    switch (action) {
      case 'START_OVER':
        state.slots = {};
        state.intent = 'search_units';
        state.pendingField = null;
        state.lastSearchIntent = null;
        state.lastSearchFilters = null;
        state.lastResultIds = undefined;
        return this.guidedMenu(state);

      case 'CONTACT_CONSULTANT':
        return this.reply(copy.HUMAN_HANDOFF, state, { ctas: [this.whatsappCta()] });

      case 'SHOW_AVAILABLE_CITIES':
        return this.showCities(state);

      case 'SHOW_AVAILABLE_TYPES':
        return this.showTypes(state);

      case 'RELAX_BUDGET':
        state.slots.budgetMax = undefined;
        state.intent = 'search_units';
        return this.routeSearch(state);

      case 'RELAX_TYPE':
      case 'SHOW_ALL_IN_CITY':
        state.slots.propertyType = undefined;
        state.intent = 'search_units';
        if (state.slots.city) return this.runUnitSearch(state);
        return this.askCity(state);

      case 'HELP_ME_CHOOSE':
      case 'RECOMMEND':
      case 'SHOW_OPTIONS':
      default:
        return this.guidedAssist(state);
    }
  }

  /**
   * "ساعدني / مش عارف / اختارلي" — answer with options for whatever we're waiting
   * on; otherwise advance the search if we already have enough, else guide.
   */
  private async guidedAssist(state: ChatState): Promise<AssistantOutput> {
    if (state.pendingField === 'city') return this.showCities(state);
    if (state.pendingField === 'propertyType') return this.showTypes(state);
    if (state.pendingField === 'budgetMax') return this.askBudget(state);

    state.intent = 'search_units';
    const s = state.slots;
    if (s.city || s.propertyType || s.budgetMax !== undefined || s.minRooms !== undefined) {
      return this.routeSearch(state);
    }
    return this.guidedMenu(state);
  }

  private async handleUnknown(state: ChatState, priorUnknown: number): Promise<AssistantOutput> {
    state.unknownStreak = priorUnknown + 1;
    this.resetFlow(state);
    // First miss: short menu. Repeated misses: escalate with real cities + human.
    if (state.unknownStreak >= 2) {
      const cities = await this.cityChips();
      return this.reply(copy.escalatedUnknownReply(cities), state, {
        quickReplies: [...cities.slice(0, 3), 'تواصل مع مستشار'],
        ctas: [this.whatsappCta()],
      });
    }
    return this.reply(copy.UNKNOWN_REPLY, state, { quickReplies: copy.HOME_QUICK_REPLIES });
  }

  /**
   * Enter or continue a search flow. Advances the moment it has enough to
   * search: a project search needs only a city; a unit search needs a city plus
   * ONE of type/budget/rooms (so "شقة في جدة" or "في جدة بحد ٢ مليون" both go),
   * and a city-only message asks exactly one useful follow-up (the type).
   */
  private async startSearch(
    intent: Intent,
    state: ChatState,
    incoming: Slots,
    leadText?: string,
  ): Promise<AssistantOutput> {
    state.intent = intent;
    state.slots = mergeSlots(state.slots, incoming);
    return this.routeSearch(state, leadText);
  }

  /**
   * Decide the next step from the current slots: ask city → (projects: search;
   * units: ask type unless we already have type/budget/rooms) → search.
   */
  private async routeSearch(state: ChatState, leadText?: string): Promise<AssistantOutput> {
    const s = state.slots;
    if (!s.city) return this.askCity(state, leadText);

    if (state.intent === 'search_projects') {
      state.pendingField = null;
      return this.runProjectSearch(state);
    }

    const hasCriteria = !!s.propertyType || s.budgetMax !== undefined || s.minRooms !== undefined;
    if (!hasCriteria) return this.askType(state);

    state.pendingField = null;
    return this.runUnitSearch(state);
  }

  private async askCity(state: ChatState, leadText?: string): Promise<AssistantOutput> {
    state.intent = state.intent ?? 'search_units';
    state.pendingField = 'city';
    const cities = await this.cityChips();
    const prompt = leadText ? `${leadText}\n${copy.SLOT_PROMPTS.city}` : copy.SLOT_PROMPTS.city;
    return this.reply(prompt, state, { missingFields: ['city'], quickReplies: cities });
  }

  private async askType(state: ChatState): Promise<AssistantOutput> {
    state.pendingField = 'propertyType';
    const types = await this.typeChips();
    return this.reply(copy.TYPE_PROMPT, state, { missingFields: ['propertyType'], quickReplies: types });
  }

  private async askBudget(state: ChatState): Promise<AssistantOutput> {
    state.pendingField = 'budgetMax';
    return this.reply(copy.BUDGET_PROMPT, state, {
      missingFields: ['budgetMax'],
      quickReplies: copy.BUDGET_QUICK_REPLIES,
    });
  }

  /** Fresh guided opener (city chips), used by help/start-over with no criteria. */
  private async guidedMenu(state: ChatState): Promise<AssistantOutput> {
    state.intent = 'search_units';
    state.pendingField = 'city';
    const cities = await this.cityChips();
    return this.reply(copy.GUIDED_MENU, state, { missingFields: ['city'], quickReplies: cities });
  }

  /** List real available cities and wait for a city pick. */
  private async showCities(state: ChatState): Promise<AssistantOutput> {
    state.intent = 'search_units';
    state.pendingField = 'city';
    const cities = await this.cityChips();
    return this.reply(copy.availableCitiesReply(cities), state, {
      missingFields: ['city'],
      quickReplies: cities,
    });
  }

  /** List real available types and wait for a type pick. */
  private async showTypes(state: ChatState): Promise<AssistantOutput> {
    state.intent = 'search_units';
    state.pendingField = 'propertyType';
    const types = await this.typeChips();
    return this.reply(copy.availableTypesReply(types), state, {
      missingFields: ['propertyType'],
      quickReplies: types,
    });
  }

  private async runUnitSearch(state: ChatState): Promise<AssistantOutput> {
    const result = await this.catalog.searchUnits(state.slots);
    this.recordSearch(state, 'search_units', buildUnitQuery(state.slots), result);
    state.pendingField = null;

    if (result.total === 0) return this.noUnitResults(state);

    const typeLabel = copy.propertyTypeLabel(state.slots.propertyType);
    const city = state.slots.city ?? '';
    const hasMore = result.total > result.cards.length;
    const summary = copy.unitResultsReply(result.total, result.cards.length, typeLabel, city);
    return this.reply(`${summary}\n${copy.AVAILABILITY_NOTE}`, state, {
      cards: result.cards,
      quickReplies: copy.resultsQuickReplies(state.slots, hasMore),
      ctas: [this.linkCta('عرض المزيد', this.unitsListHref(state.slots)), this.whatsappCta()],
    });
  }

  private async runProjectSearch(state: ChatState): Promise<AssistantOutput> {
    const result = await this.catalog.searchProjects(state.slots);
    this.recordSearch(state, 'search_projects', buildProjectQuery(state.slots), result);
    state.pendingField = null;

    const city = state.slots.city ?? '';
    if (result.total === 0) return this.noProjectResults(state);

    const summary = copy.projectResultsReply(result.total, result.cards.length, city);
    return this.reply(`${summary}\n${copy.AVAILABILITY_NOTE}`, state, {
      cards: result.cards,
      quickReplies: copy.resultsQuickReplies(state.slots, false),
      ctas: [this.linkCta('عرض كل المشاريع', '/projects'), this.whatsappCta()],
    });
  }

  /**
   * No matching units — never just repeat. If the city isn't in the catalog,
   * name the cities that are; otherwise the criteria are too tight, so offer to
   * widen (browse the whole city / change type / talk to a human).
   */
  private async noUnitResults(state: ChatState): Promise<AssistantOutput> {
    const facets = await this.facets();
    const city = state.slots.city ?? '';
    const cityInCatalog = facets.cities.some((c) => c === city);

    if (city && !cityInCatalog) {
      state.slots.city = undefined;
      state.pendingField = 'city';
      return this.reply(copy.cityNotAvailable(city, facets.cities), state, {
        missingFields: ['city'],
        quickReplies: facets.cities.length ? facets.cities.slice(0, 4) : copy.FALLBACK_CITIES,
        ctas: [this.whatsappCta()],
      });
    }

    const typeLabel = copy.propertyTypeLabel(state.slots.propertyType);
    const quick = [`عرض كل الوحدات في ${city}`, ...facets.types.slice(0, 2), 'تواصل مع مستشار'];
    return this.reply(copy.unitsTooRestrictive(typeLabel, city), state, {
      quickReplies: quick,
      ctas: [this.linkCta(`تصفّح ${city}`, this.unitsListHref({ city })), this.whatsappCta()],
    });
  }

  private async noProjectResults(state: ChatState): Promise<AssistantOutput> {
    const facets = await this.facets();
    const city = state.slots.city ?? '';
    if (city && !facets.cities.some((c) => c === city)) {
      state.slots.city = undefined;
      state.pendingField = 'city';
      return this.reply(copy.cityNotAvailable(city, facets.cities), state, {
        missingFields: ['city'],
        quickReplies: facets.cities.length ? facets.cities.slice(0, 4) : copy.FALLBACK_CITIES,
        ctas: [this.whatsappCta()],
      });
    }
    return this.reply(copy.NO_PROJECT_RESULTS, state, {
      quickReplies: ['أبحث عن وحدة', 'تواصل مع مستشار'],
      ctas: [this.whatsappCta()],
    });
  }

  /** Live catalog facets, falling back to safe defaults if the lookup fails. */
  private async facets(): Promise<{ cities: string[]; types: string[] }> {
    try {
      return await this.catalog.getFacets();
    } catch {
      return { cities: [], types: [] };
    }
  }

  private async cityChips(): Promise<string[]> {
    const f = await this.facets();
    return f.cities.length ? f.cities.slice(0, 4) : copy.FALLBACK_CITIES;
  }

  private async typeChips(): Promise<string[]> {
    const f = await this.facets();
    return f.types.length ? f.types.slice(0, 5) : copy.FALLBACK_TYPES;
  }

  // ---- Conversion (lead capture) ----

  /** Begin an info/visit flow, seeding any single recent result as context. */
  private async startConversion(type: ConversionType, state: ChatState): Promise<AssistantOutput> {
    const conv: ConversionState = { type, fields: {}, consent: undefined, pending: null };

    // If the last search returned exactly one result, treat it as the subject.
    if (state.lastResultIds?.length === 1) {
      const id = state.lastResultIds[0]!;
      if (state.lastSearchIntent === 'search_projects') conv.fields.projectId = id;
      else conv.fields.unitId = id;
    }
    state.conversion = conv;
    return this.advanceConversion(state);
  }

  /** Apply the pending answer (if any), then ask the next field or create. */
  private async handleConversion(state: ChatState, norm: string, raw: string): Promise<AssistantOutput> {
    const conv = state.conversion as ConversionState;

    if (isCancel(norm)) {
      state.conversion = null;
      return this.reply(copy.CONVERSION_CANCELLED, this.resetFlow(state), {
        quickReplies: copy.HOME_QUICK_REPLIES,
      });
    }

    if (conv.pending) {
      const outcome = await this.applyAnswer(conv, conv.pending, norm, raw, state);
      if (outcome === 'consent_no') {
        state.conversion = null;
        return this.reply(copy.CONSENT_REJECTED, this.resetFlow(state), {
          ctas: [this.whatsappCta()],
          quickReplies: copy.HOME_QUICK_REPLIES,
        });
      }
      if (outcome === 'invalid') {
        state.conversion = conv;
        return this.askField(conv, conv.pending, state, true);
      }
    }

    return this.advanceConversion(state);
  }

  /** Compute the next required step and ask for it, or create when complete. */
  private async advanceConversion(state: ChatState): Promise<AssistantOutput> {
    const conv = state.conversion as ConversionState;
    const next = this.nextStep(conv);

    if (next === 'choose_property') {
      const count = state.lastResultIds?.length ?? 0;
      if (count === 0) {
        // No property context to attach a visit to — send them to search first.
        state.conversion = null;
        return this.reply(copy.NEED_PROPERTY_FIRST, this.resetFlow(state), {
          quickReplies: ['أبحث عن مشروع', 'أبحث عن وحدة'],
        });
      }
      conv.pending = 'choose_property';
      state.conversion = conv;
      return this.reply(copy.choosePropertyPrompt(count), state, {
        missingFields: ['property'],
        quickReplies: Array.from({ length: Math.min(count, 5) }, (_, i) => String(i + 1)),
      });
    }

    if (next) {
      conv.pending = next;
      state.conversion = conv;
      return this.askField(conv, next, state, false);
    }

    // All required fields present and consent === true → create the request.
    return this.createRequest(state);
  }

  /** Apply the user's message to the pending field. */
  private async applyAnswer(
    conv: ConversionState,
    step: ConversionStep,
    norm: string,
    raw: string,
    state: ChatState,
  ): Promise<'ok' | 'invalid' | 'consent_no'> {
    switch (step) {
      case 'name': {
        const name = parseName(raw, true);
        if (!name) return 'invalid';
        conv.fields.name = name;
        return 'ok';
      }
      case 'phone': {
        const phone = parsePhone(raw);
        if (!phone) return 'invalid';
        conv.fields.phone = phone;
        return 'ok';
      }
      case 'preferredDate': {
        const date = parsePreferredDate(raw);
        if (!date) return 'invalid';
        conv.fields.preferredDate = date;
        return 'ok';
      }
      case 'consent': {
        const c = parseConsent(norm);
        if (c === 'yes') {
          conv.consent = true;
          return 'ok';
        }
        if (c === 'no') return 'consent_no';
        return 'invalid';
      }
      case 'choose_property': {
        const ids = state.lastResultIds ?? [];
        const idx = parseChoiceIndex(raw, ids.length);
        if (idx === undefined) return 'invalid';
        const id = ids[idx]!;
        if (state.lastSearchIntent === 'search_projects') {
          conv.fields.projectId = id;
        } else {
          conv.fields.unitId = id;
          conv.fields.projectId = (await this.conversion.resolveUnitProjectId(id)) ?? undefined;
        }
        return 'ok';
      }
    }
  }

  /** Order required fields; first missing one is asked next. */
  private nextStep(conv: ConversionState): ConversionStep | null {
    if (conv.type === 'visit') {
      if (!conv.fields.projectId) return 'choose_property';
      if (!conv.fields.preferredDate) return 'preferredDate';
    }
    if (!conv.fields.name) return 'name';
    if (!conv.fields.phone) return 'phone';
    if (conv.consent !== true) return 'consent';
    return null;
  }

  private askField(
    conv: ConversionState,
    step: ConversionStep,
    state: ChatState,
    invalid: boolean,
  ): AssistantOutput {
    if (step === 'choose_property') {
      const count = state.lastResultIds?.length ?? 0;
      return this.reply(copy.choosePropertyPrompt(count), state, {
        missingFields: ['property'],
        quickReplies: Array.from({ length: Math.min(count, 5) }, (_, i) => String(i + 1)),
      });
    }
    const content = invalid ? copy.CONVERSION_INVALID[step] : copy.CONVERSION_PROMPTS[step];
    const quickReplies =
      step === 'consent'
        ? copy.CONSENT_QUICK_REPLIES
        : step === 'preferredDate'
          ? copy.DATE_QUICK_REPLIES
          : copy.CONVERSION_FIELD_QUICK_REPLIES;
    return this.reply(content, state, { missingFields: [step], quickReplies });
  }

  private async createRequest(state: ChatState): Promise<AssistantOutput> {
    const conv = state.conversion as ConversionState;
    try {
      if (conv.type === 'info') {
        const res = await this.conversion.createInfoRequest({
          message: conv.fields.message ?? copy.INFO_DEFAULT_MESSAGE,
          name: conv.fields.name!,
          phone: conv.fields.phone!,
          projectId: conv.fields.projectId,
          unitId: conv.fields.unitId,
        });
        conv.createdRequestId = res.id;
        conv.done = true;
        state.conversion = conv;
        return this.reply(copy.INFO_REQUEST_SUCCESS, state, {
          ctas: [this.whatsappCta()],
          quickReplies: copy.HOME_QUICK_REPLIES,
        });
      }
      const res = await this.conversion.createVisitRequest({
        projectId: conv.fields.projectId!,
        preferredDate: conv.fields.preferredDate!,
        name: conv.fields.name!,
        phone: conv.fields.phone!,
        unitId: conv.fields.unitId,
        notes: conv.fields.message,
      });
      conv.createdRequestId = res.id;
      conv.done = true;
      state.conversion = conv;
      return this.reply(copy.VISIT_REQUEST_SUCCESS, state, {
        ctas: [this.whatsappCta()],
        quickReplies: copy.HOME_QUICK_REPLIES,
      });
    } catch {
      // Never fake success and never crash the chat. Reset consent so the user
      // can retry by confirming again.
      conv.consent = undefined;
      conv.pending = 'consent';
      state.conversion = conv;
      return this.reply(copy.CONVERSION_FAILURE, state, {
        ctas: [this.whatsappCta()],
        quickReplies: copy.CONSENT_QUICK_REPLIES,
      });
    }
  }

  /** Clear one slot the user asked to change and re-ask for it. */
  private async askForReset(field: SlotField, state: ChatState): Promise<AssistantOutput> {
    delete state.slots[field];
    state.pendingField = field;
    // City/type chips come from live catalog facets; budget/rooms are static.
    const quickReplies =
      field === 'city'
        ? await this.cityChips()
        : field === 'propertyType'
          ? await this.typeChips()
          : copy.SLOT_QUICK_REPLIES[field];
    const content = field === 'propertyType' ? copy.TYPE_PROMPT : copy.changeSlotReply(field);
    return this.reply(content, state, { missingFields: [field], quickReplies });
  }

  private recordSearch(
    state: ChatState,
    intent: Intent,
    filters: object,
    result: CatalogSearchResult,
  ): void {
    state.lastSearchIntent = intent;
    state.lastSearchFilters = { ...filters };
    state.lastResultIds = result.cards.map((c) => c.id);
  }

  /** Deep-link to the public listing carrying the same filters (best-effort). */
  private unitsListHref(slots: Slots): string {
    const params = new URLSearchParams();
    if (slots.city) params.set('city', slots.city);
    if (slots.propertyType) params.set('type', slots.propertyType);
    if (slots.minRooms !== undefined) params.set('bedrooms', String(slots.minRooms));
    if (slots.budgetMax !== undefined) params.set('priceMax', String(slots.budgetMax));
    const qs = params.toString();
    return qs ? `/units?${qs}` : '/units';
  }

  private handleFaq(norm: string, state: ChatState): AssistantOutput {
    const topic = detectFaqTopic(norm);
    const answer = (topic && copy.FAQ_ANSWERS[topic]) || copy.UNKNOWN_REPLY;
    return this.reply(answer, state, {
      quickReplies: copy.faqQuickReplies(topic),
      ctas: [this.whatsappCta()],
    });
  }

  /** Clear the active search flow (used when we bail to a generic reply). */
  private resetFlow(state: ChatState): ChatState {
    state.intent = null;
    state.pendingField = null;
    return state;
  }

  private whatsappCta(): AssistantCta {
    // Server returns the prefilled text only; the client builds the wa.me URL
    // from NEXT_PUBLIC_WHATSAPP_PHONE so the number never lives on the server.
    return {
      kind: 'whatsapp',
      action: 'whatsapp',
      label: 'تواصل عبر واتساب',
      payload: { message: copy.WHATSAPP_PREFILL },
    };
  }

  private linkCta(label: string, href: string): AssistantCta {
    return { kind: 'link', label, href };
  }

  /** Assemble the AssistantOutput and snapshot the (mutated) state into context. */
  private reply(
    content: string,
    state: ChatState,
    extra: {
      cards?: AssistantOutput['cards'];
      ctas?: AssistantCta[];
      quickReplies?: string[];
      missingFields?: string[];
    } = {},
  ): AssistantOutput {
    return {
      content,
      cards: extra.cards ?? [],
      ctas: extra.ctas ?? [],
      quickReplies: extra.quickReplies ?? [],
      missingFields: extra.missingFields ?? [],
      context: { ...state },
      tokensIn: 0,
      tokensOut: 0,
    };
  }
}
