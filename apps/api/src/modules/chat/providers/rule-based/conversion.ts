/**
 * Conversion (lead-capture) tool contract + state types. The provider drives a
 * deterministic, consent-gated slot-filling flow and, only once all required
 * fields AND explicit consent are collected, calls this tool to create the
 * request through the authoritative backend service. No request is ever created
 * without consent; the backend remains the source of truth and re-validates.
 *
 * The Nest-injectable implementation lives in conversion.service.ts; the
 * provider depends only on this abstract token, so tests use a fake.
 */

export type ConversionType = 'info' | 'visit';

/** Steps the flow can be waiting on (one question at a time). */
export type ConversionStep = 'choose_property' | 'preferredDate' | 'name' | 'phone' | 'consent';

export interface ConversionFields {
  name?: string;
  phone?: string;
  /** Inquiry text (info flow); synthesized if the user didn't type one. */
  message?: string;
  /** ISO date string (visit flow). */
  preferredDate?: string;
  projectId?: string;
  unitId?: string;
}

export interface ConversionState {
  type: ConversionType;
  fields: ConversionFields;
  /** Explicit consent to use the data; a request is created only when true. */
  consent?: boolean;
  /** The field we last asked for (the next user message answers it). */
  pending?: ConversionStep | null;
  /** Set after a successful create (kept for reference; flow no longer active). */
  createdRequestId?: string;
  done?: boolean;
}

export interface CreateInfoInput {
  message: string;
  name: string;
  phone: string;
  projectId?: string;
  unitId?: string;
}

export interface CreateVisitInput {
  projectId: string;
  preferredDate: string;
  name: string;
  phone: string;
  unitId?: string;
  notes?: string;
}

export abstract class ConversionTool {
  abstract createInfoRequest(input: CreateInfoInput): Promise<{ id: string }>;
  abstract createVisitRequest(input: CreateVisitInput): Promise<{ id: string }>;
  /** Resolve a unit's parent project id (visit requests require a projectId). */
  abstract resolveUnitProjectId(unitId: string): Promise<string | null>;
}
