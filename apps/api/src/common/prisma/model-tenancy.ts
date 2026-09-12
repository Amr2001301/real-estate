/**
 * MT-012 — MODEL_TENANCY: five-tier tenant classification for every Prisma model.
 *
 * TIERS:
 *   PLATFORM_GLOBAL      — No companyId. No injection. No tenant filter.
 *                          Examples: Company, Permission, OtpCode.
 *
 *   TENANT_OWNED         — Has companyId column. Middleware auto-injects and
 *                          filters. Throws MissingTenantContextError when no
 *                          context and no bypass. 46 domain models total.
 *
 *   TENANT_VIA_RELATION  — No companyId column. Scoped through a parent FK
 *                          (e.g. userId → User, projectId → Project). No
 *                          automatic injection; callers must always filter via
 *                          the parent key.
 *
 *   TENANT_CONTROLLED    — Has companyId but middleware does NOT inject it.
 *                          Every query must carry an explicit companyId at the
 *                          service layer. User is the only current member.
 *
 *   CROSS_TENANT_CONTROLLED — Reserved for future cross-tenant models (V2.1).
 *                             Middleware throws on any unguarded access. No
 *                             models exist yet; classification added here only
 *                             when the Prisma model is created.
 *
 * BOOT CONTRACT (MT-013):
 *   PrismaService.onModuleInit iterates Prisma.dmmf.datamodel.models and
 *   asserts every existing model appears in MODEL_TENANCY. A missing entry
 *   causes startup to throw — fail-closed, not fail-open.
 *
 *   InventoryAccessGrant and other V2.1 models are NOT listed here. They are
 *   added in the same PR that creates the Prisma model.
 */

export type ModelTenancyTier =
  | 'PLATFORM_GLOBAL'
  | 'TENANT_OWNED'
  | 'TENANT_VIA_RELATION'
  | 'TENANT_CONTROLLED'
  | 'CROSS_TENANT_CONTROLLED';

/**
 * Authoritative classification map. Keys are Prisma model names exactly as
 * they appear in Prisma.dmmf.datamodel.models[n].name (PascalCase).
 *
 * Every model in the current schema.prisma must appear here. If you add a new
 * Prisma model and forget to add it, the application will refuse to start.
 */
export const MODEL_TENANCY: Readonly<Record<string, ModelTenancyTier>> = {
  // ── PLATFORM_GLOBAL ────────────────────────────────────────────────────────
  // Globally unique; no per-tenant filter. Accessible in bypass context only
  // for write operations; platform-global reads are safe anywhere.
  Company: 'PLATFORM_GLOBAL',
  Permission: 'PLATFORM_GLOBAL',
  PricingPackage: 'PLATFORM_GLOBAL', // nullable companyId; filtered explicitly by callers

  // ── TENANT_CONTROLLED ──────────────────────────────────────────────────────
  // Middleware pass-through. Explicit service-level companyId enforcement required.
  User: 'TENANT_CONTROLLED',
  // MT-030: OtpCode reclassified from PLATFORM_GLOBAL. companyId column added in
  // MT-021. Service layer supplies companyId on every OtpCode read and write.
  // Option-A cutover: new OTPs written with companyId; legacy null-companyId OTPs
  // expire within OTP_TTL_MIN (10 min); strict enforcement via feature flag.
  OtpCode: 'TENANT_CONTROLLED',
  // MT-044: CompanyDomain queried before tenant context exists (DomainResolverService).
  // Writes always enforce explicit ownership: req.user.companyId === companyId.
  CompanyDomain: 'TENANT_CONTROLLED',

  // ── TENANT_VIA_RELATION ────────────────────────────────────────────────────
  // No companyId column. Scoped through a parent FK. No auto-injection.
  RefreshToken: 'TENANT_VIA_RELATION',             // userId → User
  PasswordResetToken: 'TENANT_VIA_RELATION',        // userId → User
  EmailVerificationToken: 'TENANT_VIA_RELATION',    // userId → User
  DeviceToken: 'TENANT_VIA_RELATION',               // userId → User
  UserPermission: 'TENANT_VIA_RELATION',            // userId → User
  Favorite: 'TENANT_VIA_RELATION',                  // userId → User
  ProjectMedia: 'TENANT_VIA_RELATION',              // projectId → Project
  UnitMedia: 'TENANT_VIA_RELATION',                 // unitId → Unit
  InstallmentPlanDurationOption: 'TENANT_VIA_RELATION', // planId → InstallmentPlanTemplate
  PlanTemplateScheduleItem: 'TENANT_VIA_RELATION',  // planId → InstallmentPlanTemplate

  // ── TENANT_OWNED ───────────────────────────────────────────────────────────
  // Has companyId column. Middleware auto-injects and filters. (46 models)

  // Projects / inventory
  Project: 'TENANT_OWNED',
  Phase: 'TENANT_OWNED',
  Building: 'TENANT_OWNED',
  Unit: 'TENANT_OWNED',
  UnitStatusHistory: 'TENANT_OWNED',
  UnitMaintenanceItem: 'TENANT_OWNED',

  // CRM
  LeadSource: 'TENANT_OWNED',
  Lead: 'TENANT_OWNED',
  LeadNote: 'TENANT_OWNED',
  LeadActivity: 'TENANT_OWNED',

  // Requests / visits
  InfoRequest: 'TENANT_OWNED',
  VisitRequest: 'TENANT_OWNED',
  VisitAppointment: 'TENANT_OWNED',
  VisitActivity: 'TENANT_OWNED',

  // Reservations / contracts / payments
  Reservation: 'TENANT_OWNED',
  ReservationNote: 'TENANT_OWNED',
  ReservationActivity: 'TENANT_OWNED',
  Contract: 'TENANT_OWNED',
  InstallmentPlan: 'TENANT_OWNED',
  Installment: 'TENANT_OWNED',
  Deposit: 'TENANT_OWNED',
  InstallmentPlanTemplate: 'TENANT_OWNED',

  // Bonus / targets
  BonusRule: 'TENANT_OWNED',
  BonusEntry: 'TENANT_OWNED',
  SalesTarget: 'TENANT_OWNED',

  // Maintenance
  MaintenanceCategory: 'TENANT_OWNED',
  MaintenanceRequest: 'TENANT_OWNED',
  MaintenanceRequestItem: 'TENANT_OWNED',

  // CMS / notifications
  CmsPage: 'TENANT_OWNED',
  Banner: 'TENANT_OWNED',
  Article: 'TENANT_OWNED',
  NotificationTemplate: 'TENANT_OWNED',
  Notification: 'TENANT_OWNED',
  AuditLog: 'TENANT_OWNED',

  // Brokers
  Broker: 'TENANT_OWNED',
  BrokerUser: 'TENANT_OWNED',
  BrokerProjectAccess: 'TENANT_OWNED',
  BrokerUnitAccess: 'TENANT_OWNED',
  BrokerCommission: 'TENANT_OWNED',
  BrokerPayout: 'TENANT_OWNED',
  BrokerActivityLog: 'TENANT_OWNED',

  // Platform utilities
  Setting: 'TENANT_OWNED',
  Document: 'TENANT_OWNED',

  // Chat
  ChatSession: 'TENANT_OWNED',
  ChatMessage: 'TENANT_OWNED',
  ChatFeedback: 'TENANT_OWNED',
} as const;
