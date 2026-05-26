/**
 * Multi-turn conversation state for the rule-based assistant. Persisted opaquely
 * in ChatSession.metadata between requests, so the engine itself stays stateless
 * (state in → state out). Keep this serializable (plain JSON, no class instances).
 */

import type { Intent } from './intents';
import type { Slots, SlotField } from './slots';
import type { ConversionState } from './conversion';

export interface ChatState {
  /** The flow the user is currently in (search_units/search_projects/...). */
  intent?: Intent | null;
  /** Accumulated search criteria across turns. */
  slots: Slots;
  /** The slot we last asked the user to provide (so a bare reply fills it). */
  pendingField?: SlotField | null;
  /** What the last completed catalog search ran (for follow-ups / debugging). */
  lastSearchIntent?: Intent | null;
  lastSearchFilters?: Record<string, unknown> | null;
  lastResultIds?: string[];
  /** Active lead-capture flow (info/visit), if any. */
  conversion?: ConversionState | null;
  turnCount: number;
}

export function emptyState(): ChatState {
  return { intent: null, slots: {}, pendingField: null, turnCount: 0 };
}

/** Coerce whatever was stored in ChatSession.metadata into a valid ChatState. */
export function loadState(raw: Record<string, unknown> | null | undefined): ChatState {
  if (!raw || typeof raw !== 'object') return emptyState();
  const r = raw as Partial<ChatState>;
  const slots = (raw as { slots?: unknown }).slots;
  return {
    intent: r.intent ?? null,
    slots: slots && typeof slots === 'object' ? (slots as Slots) : {},
    pendingField: r.pendingField ?? null,
    lastSearchIntent: r.lastSearchIntent ?? null,
    lastSearchFilters: r.lastSearchFilters ?? null,
    lastResultIds: Array.isArray(r.lastResultIds) ? r.lastResultIds : undefined,
    conversion: r.conversion ?? null,
    turnCount: typeof r.turnCount === 'number' ? r.turnCount : 0,
  };
}

/** Merge newly extracted slots over the existing ones (new values win). */
export function mergeSlots(current: Slots, incoming: Slots): Slots {
  return { ...current, ...incoming };
}

/** Field-collection order per search flow; the first missing one is asked next. */
const UNIT_REQUIRED: SlotField[] = ['propertyType', 'city'];
const PROJECT_REQUIRED: SlotField[] = ['city'];

export function requiredFields(intent: Intent | null | undefined): SlotField[] {
  if (intent === 'search_projects') return PROJECT_REQUIRED;
  return UNIT_REQUIRED;
}

/** Required fields still absent from the collected slots, in ask order. */
export function missingRequired(intent: Intent | null | undefined, slots: Slots): SlotField[] {
  return requiredFields(intent).filter((f) => slots[f] === undefined);
}
