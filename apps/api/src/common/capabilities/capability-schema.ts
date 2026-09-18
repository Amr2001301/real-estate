/**
 * Phase 1 capability schema — typed keys, plan defaults, override validation.
 *
 * THREE-LAYER MODEL (highest wins):
 *  1. PLAN DEFAULTS  — in code, per SubscriptionPlan tier
 *  2. OVERRIDES      — stored in Company.capabilities (Json?), validated on write
 *  3. EFFECTIVE      — merge of 1 and 2; what every check consults
 *
 * For feature.publicWebsite / feature.customerApp / feature.staffApp:
 *   These map 1-to-1 to Company.websiteEnabled / customerAppEnabled / staffAppEnabled
 *   columns, which are nullable.  NULL means "no explicit override — use the plan
 *   default."  A non-null column value always wins over the plan default.
 *   A super-admin who wants to override these uses PATCH /super-admin/companies/:id.
 *
 * USER SEAT COUNTING:
 *   Only staff roles consume a seat (STAFF_SEAT_ROLES below).
 *   Soft-deleted users (deletedAt IS NOT NULL) are excluded.
 *   Inactive staff (active=false) STILL count — the account holds a seat.
 *   CLIENT, CUSTOMER, and SUPER_ADMIN never count toward the seat limit.
 */

import type { SubscriptionPlan, UserRole } from '@prisma/client';

// ── Staff seat roles ──────────────────────────────────────────────────────────
// Only these roles consume a user seat toward the plan's limit.maxUsers limit.
// Excluded: CLIENT, CUSTOMER (end-users, not staff), SUPER_ADMIN (platform-level).
// Soft-deleted users (deletedAt IS NOT NULL) are additionally excluded at query time.
// Inactive staff (active=false) STILL count — the account holds the seat.

export const STAFF_SEAT_ROLES = [
  'ADMIN',
  'SALES',
  'SALES_MANAGER',
  'MAINTENANCE_SUPERVISOR',
  'BROKER',
] as const satisfies readonly UserRole[];

// ── Key sets ─────────────────────────────────────────────────────────────────

export const LIMIT_KEYS = [
  'limit.maxUnits',
  'limit.maxUsers',
  'limit.maxProjects',
] as const;

export const FEATURE_KEYS = [
  'feature.dashboard',
  'feature.crm',
  'feature.contracts',
  'feature.installments',
  'feature.staffApp',
  'feature.customerApp',
  'feature.publicWebsite',
  'feature.brokers',
  'feature.advancedReports',
  'feature.maintenance',
  'feature.customDomain',
] as const;

export type LimitKey = (typeof LIMIT_KEYS)[number];
export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type CapabilityKey = LimitKey | FeatureKey;

export const ALL_CAPABILITY_KEYS: readonly CapabilityKey[] = [
  ...LIMIT_KEYS,
  ...FEATURE_KEYS,
];

// Keys that are stored in the Company.capabilities blob (excludes the three
// column-backed feature keys which are managed via Company columns directly).
export const OVERRIDE_ELIGIBLE_KEYS = [
  'limit.maxUnits',
  'limit.maxUsers',
  'limit.maxProjects',
  'feature.brokers',
  'feature.advancedReports',
  'feature.maintenance',
  'feature.customDomain',
] as const;

export type OverrideEligibleKey = (typeof OVERRIDE_ELIGIBLE_KEYS)[number];

// ── Value types ───────────────────────────────────────────────────────────────

export type LimitValue = number | null; // null = unlimited
export type FeatureValue = boolean;
export type CapabilityValue = LimitValue | FeatureValue;

// Typed override blob stored in Company.capabilities
export type CapabilityOverrides = {
  [K in OverrideEligibleKey]?: K extends LimitKey ? LimitValue : FeatureValue;
};

// ── Side-by-side view (one row per key) ──────────────────────────────────────

export interface CapabilityKeyView {
  key: CapabilityKey;
  planDefault: CapabilityValue;
  /** undefined means no override is set for this key */
  override: CapabilityValue | undefined;
  effective: CapabilityValue;
  /** How the effective value was determined */
  source: 'plan_default' | 'capabilities_override' | 'company_column';
}

export interface EffectiveCapabilitiesView {
  plan: SubscriptionPlan;
  keys: CapabilityKeyView[];
}

// ── Plan defaults ─────────────────────────────────────────────────────────────

type PlanDefaults = Record<CapabilityKey, CapabilityValue>;

export const PLAN_DEFAULTS: Record<SubscriptionPlan, PlanDefaults> = {
  TRIAL: {
    'limit.maxUnits':       150,
    'limit.maxUsers':       15,
    'limit.maxProjects':    5,
    'feature.dashboard':    true,
    'feature.crm':          true,
    'feature.contracts':    true,
    'feature.installments': true,
    'feature.staffApp':     true,
    'feature.customerApp':  true,
    'feature.publicWebsite':true,
    'feature.brokers':      true,
    'feature.advancedReports': true,
    'feature.maintenance':  true,
    'feature.customDomain': true,
  },
  STARTER: {
    'limit.maxUnits':       500,
    'limit.maxUsers':       15,
    'limit.maxProjects':    5,
    'feature.dashboard':    true,
    'feature.crm':          true,
    'feature.contracts':    true,
    'feature.installments': true,
    'feature.staffApp':     true,
    'feature.customerApp':  false,
    'feature.publicWebsite':false,
    'feature.brokers':      false,
    'feature.advancedReports': false,
    'feature.maintenance':  false,
    'feature.customDomain': false,
  },
  PROFESSIONAL: {
    'limit.maxUnits':       2500,
    'limit.maxUsers':       50,
    'limit.maxProjects':    20,
    'feature.dashboard':    true,
    'feature.crm':          true,
    'feature.contracts':    true,
    'feature.installments': true,
    'feature.staffApp':     true,
    'feature.customerApp':  true,
    'feature.publicWebsite':true,
    'feature.brokers':      true,
    'feature.advancedReports': true,
    'feature.maintenance':  false,
    'feature.customDomain': false,
  },
  ENTERPRISE: {
    'limit.maxUnits':       null,
    'limit.maxUsers':       null,
    'limit.maxProjects':    null,
    'feature.dashboard':    true,
    'feature.crm':          true,
    'feature.contracts':    true,
    'feature.installments': true,
    'feature.staffApp':     true,
    'feature.customerApp':  true,
    'feature.publicWebsite':true,
    'feature.brokers':      true,
    'feature.advancedReports': true,
    'feature.maintenance':  true,
    'feature.customDomain': true,
  },
  CUSTOM: {
    'limit.maxUnits':       null,
    'limit.maxUsers':       null,
    'limit.maxProjects':    null,
    'feature.dashboard':    true,
    'feature.crm':          true,
    'feature.contracts':    true,
    'feature.installments': true,
    'feature.staffApp':     true,
    'feature.customerApp':  true,
    'feature.publicWebsite':true,
    'feature.brokers':      true,
    'feature.advancedReports': true,
    'feature.maintenance':  true,
    'feature.customDomain': true,
  },
};

// ── Synchronous effective view builder ───────────────────────────────────────

/**
 * Builds the EffectiveCapabilitiesView synchronously from already-loaded company data.
 * Used by CapabilityService.getEffectiveCapabilities and the super-admin report
 * (which bulk-loads all companies in one query to avoid N+1).
 */
export function buildEffectiveView(
  plan: SubscriptionPlan,
  rawOverrides: Record<string, unknown>,
  websiteEnabled: boolean | null,
  customerAppEnabled: boolean | null,
  staffAppEnabled: boolean | null,
): EffectiveCapabilitiesView {
  const planDefaults = PLAN_DEFAULTS[plan];
  // Only include a column key when it carries an explicit (non-null) value.
  // A null column means "no override — fall through to plan default" below.
  const columnValues: Record<string, boolean> = {};
  if (websiteEnabled !== null)     columnValues['feature.publicWebsite'] = websiteEnabled;
  if (customerAppEnabled !== null) columnValues['feature.customerApp']   = customerAppEnabled;
  if (staffAppEnabled !== null)    columnValues['feature.staffApp']      = staffAppEnabled;

  const keys = ALL_CAPABILITY_KEYS.map((key: CapabilityKey) => {
    const planDefault: CapabilityValue = planDefaults[key];

    if (key in columnValues) {
      const effective = columnValues[key]!;
      const blobOverride = rawOverrides[key];
      return {
        key,
        planDefault,
        override: blobOverride !== undefined ? (blobOverride as boolean) : undefined,
        effective,
        source: 'company_column' as const,
      };
    }

    const blobOverride = (OVERRIDE_ELIGIBLE_KEYS as readonly string[]).includes(key)
      ? rawOverrides[key]
      : undefined;
    const hasOverride = blobOverride !== undefined;
    const effective: CapabilityValue = hasOverride
      ? (blobOverride as CapabilityValue)
      : planDefault;

    return {
      key,
      planDefault,
      override: hasOverride ? (blobOverride as CapabilityValue) : undefined,
      effective,
      source: (hasOverride ? 'capabilities_override' : 'plan_default') as
        'capabilities_override' | 'plan_default',
    };
  });

  return { plan, keys };
}

// ── Override validation ───────────────────────────────────────────────────────

export interface OverrideValidationError {
  key: string;
  reason: string;
}

/**
 * Returns an array of validation errors for a raw overrides object.
 * An empty array means the overrides are valid.
 */
export function validateCapabilityOverrides(
  raw: unknown,
): OverrideValidationError[] {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return [{ key: '(root)', reason: 'must be a plain object' }];
  }

  const errors: OverrideValidationError[] = [];
  const obj = raw as Record<string, unknown>;

  for (const [key, value] of Object.entries(obj)) {
    if (!(OVERRIDE_ELIGIBLE_KEYS as readonly string[]).includes(key)) {
      errors.push({ key, reason: `unknown or non-overridable capability key` });
      continue;
    }

    if ((LIMIT_KEYS as readonly string[]).includes(key)) {
      if (value !== null && (typeof value !== 'number' || !Number.isInteger(value) || (value as number) < 0)) {
        errors.push({ key, reason: 'limit value must be a non-negative integer or null (unlimited)' });
      }
    } else {
      if (typeof value !== 'boolean') {
        errors.push({ key, reason: 'feature value must be a boolean' });
      }
    }
  }

  return errors;
}
