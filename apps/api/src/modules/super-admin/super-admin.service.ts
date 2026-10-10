import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma, SubscriptionStatus, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { DEFAULT_CURRENCY } from '../../common/currency/currency';
import { PrismaService } from '../../common/prisma/prisma.service';
import { phoneForWrite } from '../../common/utils/phone-for-write';
import { CapabilityService, type CompanyCapabilities } from '../../common/capabilities/capability.service';
import { buildEffectiveView, STAFF_SEAT_ROLES } from '../../common/capabilities/capability-schema';
import { DomainResolverService } from '../../common/domain/domain-resolver.service';
import { CompanyDomainsService, RESERVED_PLATFORM_SLUGS } from '../company-domains/company-domains.service';
import { seedCancellationSettingsForCompany } from '../contracts/cancellation-settings.constants';
import { NotificationsService } from '../notifications/notifications.module';
import { USER_ROLE_AR } from '../notifications/notification-catalog';
import { runInCompany } from '../../common/tenant/tenant-context';
import type {
  CreateCompanyDto,
  UpdateCompanyDto,
  UpdateCapabilitiesDto,
  UpdateCapabilityOverridesDto,
  CancelCompanyDto,
  CreateCompanyAdminDto,
  CreateCompanyUserDto,
  CreatePricingPackageDto,
  UpdatePricingPackageDto,
  UpdateCompanyModulesDto,
} from './dto/super-admin.dto';

@Injectable()
export class SuperAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capabilityService: CapabilityService,
    private readonly domainResolver: DomainResolverService,
    private readonly companyDomainsService: CompanyDomainsService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  private readonly logger = new Logger(SuperAdminService.name);

  /**
   * The platform acts on a company from outside it: its own admins hear
   * about their subscription and account (in that company's context).
   * Best-effort — never fails the platform action.
   */
  private async notifyCompanyAdmins(
    companyId: string,
    code: string,
    payload: Record<string, unknown> = {},
  ) {
    if (!this.notifications) return;
    try {
      await runInCompany(companyId, () =>
        this.notifications!.sendToRoles([UserRole.ADMIN], code, payload),
      );
    } catch (err) {
      this.logger.warn(`notifyCompanyAdmins(${code}) failed: ${(err as Error).message}`);
    }
  }

  /** A new account created by the platform gets its welcome. */
  private async welcome(companyId: string, user: { id: string; fullName: string; role: string }) {
    if (!this.notifications) return;
    try {
      await runInCompany(companyId, () =>
        this.notifications!.sendToUser(user.id, 'user_account_created', {
          name: user.fullName,
          roleLabel: USER_ROLE_AR[user.role] ?? user.role,
          entityType: 'user',
          entityId: user.id,
        }),
      );
    } catch (err) {
      this.logger.warn(`welcome failed: ${(err as Error).message}`);
    }
  }

  async listCompanies() {
    const companies = await this.prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { users: { where: { role: { not: 'SUPER_ADMIN' } } } } } },
    });
    // MT-043: include D1 foundation fields in platform-admin projection
    return companies.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      country: c.country,
      currency: c.currency,
      isActive: c.isActive,
      type: c.type,
      lifecycleStatus: c.lifecycleStatus,
      capabilities: c.capabilities,
      websiteEnabled: c.websiteEnabled,
      customerAppEnabled: c.customerAppEnabled,
      staffAppEnabled: c.staffAppEnabled,
      subscriptionPlan: c.subscriptionPlan,
      subscriptionStatus: c.subscriptionStatus,
      subscriptionStartAt: c.subscriptionStartAt,
      subscriptionEndAt: c.subscriptionEndAt,
      maxUsers: c.maxUsers,
      cancelledAt: c.cancelledAt,
      cancelReason: c.cancelReason,
      userCount: c._count.users,
      createdAt: c.createdAt,
    }));
  }

  async getCompany(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        _count: { select: { users: { where: { role: { not: 'SUPER_ADMIN' } } } } },
        users: {
          where: { role: { not: 'SUPER_ADMIN' } },
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            active: true,
            lastLoginAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    // MT-043: return D1 foundation fields in platform-admin detail view
    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      logoUrl: company.logoUrl,
      country: company.country,
      currency: company.currency,
      defaultLocale: company.defaultLocale,
      timezone: company.timezone,
      isActive: company.isActive,
      type: company.type,
      lifecycleStatus: company.lifecycleStatus,
      capabilities: company.capabilities,
      websiteEnabled: company.websiteEnabled,
      customerAppEnabled: company.customerAppEnabled,
      staffAppEnabled: company.staffAppEnabled,
      subscriptionPlan: company.subscriptionPlan,
      subscriptionStatus: company.subscriptionStatus,
      subscriptionStartAt: company.subscriptionStartAt,
      subscriptionEndAt: company.subscriptionEndAt,
      maxUsers: company.maxUsers,
      cancelledAt: company.cancelledAt,
      cancelReason: company.cancelReason,
      modules: company.modules,
      userCount: company._count.users,
      users: company.users,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
  }

  async createCompany(dto: CreateCompanyDto) {
    // Reserved slug check — before the duplicate check to give a clearer error message.
    if (RESERVED_PLATFORM_SLUGS.has(dto.slug)) {
      throw new BadRequestException({
        message: `Slug "${dto.slug}" is reserved for platform use`,
        code: 'SLUG_RESERVED',
      });
    }

    const existing = await this.prisma.company.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('A company with this slug already exists');

    // MT-045 + atomicity: company creation and platform subdomain provisioning are a single
    // atomic unit. If provisioning fails, the company row is also rolled back.
    const company = await this.prisma.$transaction(async (tx) => {
      const newCompany = await tx.company.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          country: dto.country,
          currency: dto.currency ?? DEFAULT_CURRENCY,
          timezone: dto.timezone ?? 'Africa/Cairo',
          subscriptionPlan: dto.subscriptionPlan ?? 'TRIAL',
          subscriptionStatus: 'TRIAL',
          subscriptionStartAt: dto.subscriptionStartAt ? new Date(dto.subscriptionStartAt) : null,
          subscriptionEndAt: dto.subscriptionEndAt ? new Date(dto.subscriptionEndAt) : null,
          maxUsers: dto.maxUsers ?? null,
          // MT-040: explicit type — default is DEVELOPER (current platform behavior).
          // BROKERAGE companies are schema-representable but workflows are deferred.
          type: dto.type ?? 'DEVELOPER',
          // MT-036: lifecycle starts ACTIVE for all new companies.
          lifecycleStatus: 'ACTIVE',
          // MT-040A: exposure flags — null means "use plan default."
          // Only store an explicit boolean when the caller explicitly overrides the plan.
          websiteEnabled: dto.websiteEnabled ?? null,
          customerAppEnabled: dto.customerAppEnabled ?? null,
          staffAppEnabled: dto.staffAppEnabled ?? null,
        },
      });

      await this.companyDomainsService.provisionPlatformSubdomain(newCompany.id, newCompany.slug, tx);
      return newCompany;
    });

    // Step D2: seed the 8 cancellation/cheque settings with documented defaults.
    // SUPER_ADMIN calls run in bypass context (bypass=true) so the middleware
    // passes createMany through without tenant-scope injection — the explicit
    // companyId per row is respected. Idempotent (skipDuplicates); existing
    // operator-configured values are never overwritten.
    await seedCancellationSettingsForCompany(this.prisma, company.id);

    let adminUser = null;
    if (dto.adminEmail && dto.adminPassword && dto.adminFullName) {
      adminUser = await this.createCompanyAdmin(company.id, {
        email: dto.adminEmail,
        password: dto.adminPassword,
        fullName: dto.adminFullName,
      });
    }

    return { company, adminUser };
  }

  async updateCompany(id: string, dto: UpdateCompanyDto) {
    await this.assertExists(id);

    // When the subscription plan changes, derive maxUsers from the matching
    // PricingPackage so the company limit stays in sync with the package definition.
    // A manual dto.maxUsers without a plan change still works as an explicit override.
    let syncedMaxUsers: number | null | undefined;
    if (dto.subscriptionPlan !== undefined) {
      const pkg = await this.prisma.pricingPackage.findFirst({
        where: { planTier: dto.subscriptionPlan },
        select: { maxUsers: true },
      });
      // pkg found: use its maxUsers (may be null for unlimited/CUSTOM)
      // pkg not found: leave undefined so we fall back to dto.maxUsers
      if (pkg !== null && pkg !== undefined) {
        syncedMaxUsers = pkg.maxUsers ?? null;
      }
    }

    const updated = await this.prisma.company.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.subscriptionPlan !== undefined && { subscriptionPlan: dto.subscriptionPlan }),
        ...(dto.subscriptionStatus !== undefined && { subscriptionStatus: dto.subscriptionStatus }),
        ...(dto.subscriptionStartAt !== undefined && {
          subscriptionStartAt: dto.subscriptionStartAt ? new Date(dto.subscriptionStartAt) : null,
        }),
        ...(dto.subscriptionEndAt !== undefined && {
          subscriptionEndAt: dto.subscriptionEndAt ? new Date(dto.subscriptionEndAt) : null,
        }),
        // Plan change: use package-derived limit; otherwise use explicit dto.maxUsers
        ...(syncedMaxUsers !== undefined
          ? { maxUsers: syncedMaxUsers }
          : dto.maxUsers !== undefined && { maxUsers: dto.maxUsers }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        // MT-036 / MT-040A: lifecycle status and exposure flags are mutable by SUPER_ADMIN.
        // Company.type is intentionally NOT mutable here (see MT-042 decision: type is
        // immutable post-creation — reclassification requires a future safe workflow).
        ...(dto.lifecycleStatus !== undefined && { lifecycleStatus: dto.lifecycleStatus }),
        ...(dto.websiteEnabled !== undefined && { websiteEnabled: dto.websiteEnabled }),
        ...(dto.customerAppEnabled !== undefined && { customerAppEnabled: dto.customerAppEnabled }),
        ...(dto.staffAppEnabled !== undefined && { staffAppEnabled: dto.staffAppEnabled }),
      },
    });

    // MT-055: Invalidate domain cache when lifecycle or websiteEnabled changes — these
    // fields are part of the resolved domain projection cached by DomainResolverService.
    if (dto.lifecycleStatus !== undefined || dto.websiteEnabled !== undefined) {
      await this.domainResolver.invalidateAllForCompany(id);
    }

    // Phase 2: invalidate capability cache when plan or app-flag columns change.
    if (
      dto.subscriptionPlan !== undefined ||
      dto.staffAppEnabled !== undefined ||
      dto.customerAppEnabled !== undefined ||
      dto.websiteEnabled !== undefined
    ) {
      await this.capabilityService.invalidateCache(id);
    }

    return updated;
  }

  // MT-041: Company hard-delete is permanently blocked at the application layer.
  // Use lifecycle archival (lifecycleStatus = ARCHIVED) instead.
  // Physical DB deletion would orphan tenant data across ~40 tables; FK onDelete
  // DB enforcement (Phase M) is a separate future defence-in-depth measure.
  deleteCompany(_id: string): never {
    throw new ForbiddenException({
      message: 'Company hard-delete is not permitted. Transition to lifecycleStatus=ARCHIVED instead.',
      code: 'COMPANY_DELETE_FORBIDDEN',
    });
  }

  // MT-042: dedicated capability update — updates DB and invalidates the cache
  async updateCapabilities(id: string, dto: UpdateCapabilitiesDto): Promise<{ capabilities: CompanyCapabilities }> {
    await this.assertExists(id);
    const caps = dto.capabilities as CompanyCapabilities;
    await this.capabilityService.setCapabilities(id, caps);
    return { capabilities: caps };
  }

  // Phase 1 — typed override write
  async setCapabilityOverrides(id: string, dto: UpdateCapabilityOverridesDto) {
    return this.capabilityService.setCapabilityOverrides(id, dto.overrides);
  }

  // Phase 1 — side-by-side view (plan default / override / effective) for all keys
  async getCapabilitiesView(id: string) {
    return this.capabilityService.getEffectiveCapabilities(id);
  }

  // Phase 1 — usage counts (units, users, projects) vs effective limits
  async getCompanyUsage(id: string) {
    // assertExists handled inside getEffectiveCapabilities (throws NotFoundException)
    const [effectiveView, unitCount, userCount, projectCount] = await Promise.all([
      this.capabilityService.getEffectiveCapabilities(id),
      this.prisma.unit.count({ where: { companyId: id } }),
      this.prisma.user.count({ where: { companyId: id, deletedAt: null, role: { in: [...STAFF_SEAT_ROLES] } } }),
      this.prisma.project.count({ where: { companyId: id } }),
    ]);

    const getEffective = (key: string) =>
      effectiveView.keys.find((k) => k.key === key)?.effective ?? null;

    return {
      companyId: id,
      plan: effectiveView.plan,
      limits: {
        units:    { limit: getEffective('limit.maxUnits')    as number | null, used: unitCount },
        users:    { limit: getEffective('limit.maxUsers')    as number | null, used: userCount },
        projects: { limit: getEffective('limit.maxProjects') as number | null, used: projectCount },
      },
    };
  }

  // Phase 1 — cross-company compliance report
  // Returns every company with its effective limits, usage, and which features are enabled.
  // Used by the super-admin before enforcing limits in Phase 2.
  async getCapabilityReport() {
    const companies = await this.prisma.company.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        lifecycleStatus: true,
        capabilities: true,
        websiteEnabled: true,
        customerAppEnabled: true,
        staffAppEnabled: true,
        _count: {
          select: {
            units: true,
            projects: true,
            users: { where: { deletedAt: null, role: { in: [...STAFF_SEAT_ROLES] } } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const rows = companies.map((c) => {
      const view = buildEffectiveView(
        c.subscriptionPlan,
        (c.capabilities as Record<string, unknown> | null) ?? {},
        c.websiteEnabled,
        c.customerAppEnabled,
        c.staffAppEnabled,
      );

      const maxUnits    = view.keys.find((k) => k.key === 'limit.maxUnits')?.effective    as number | null;
      const maxUsers    = view.keys.find((k) => k.key === 'limit.maxUsers')?.effective    as number | null;
      const maxProjects = view.keys.find((k) => k.key === 'limit.maxProjects')?.effective as number | null;

      const usedUnits    = c._count.units;
      const usedUsers    = c._count.users;
      const usedProjects = c._count.projects;

      const overLimit = (
        (maxUnits    !== null && usedUnits    > maxUnits) ||
        (maxUsers    !== null && usedUsers    > maxUsers) ||
        (maxProjects !== null && usedProjects > maxProjects)
      );
      const nearLimit = !overLimit && (
        (maxUnits    !== null && usedUnits    >= maxUnits    * 0.8) ||
        (maxUsers    !== null && usedUsers    >= maxUsers    * 0.8) ||
        (maxProjects !== null && usedProjects >= maxProjects * 0.8)
      );

      const features = Object.fromEntries(
        view.keys
          .filter((k) => k.key.startsWith('feature.'))
          .map((k) => [k.key, k.effective]),
      );

      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        plan: c.subscriptionPlan,
        subscriptionStatus: c.subscriptionStatus,
        lifecycleStatus: c.lifecycleStatus,
        usage: {
          units:    { used: usedUnits,    limit: maxUnits },
          users:    { used: usedUsers,    limit: maxUsers },
          projects: { used: usedProjects, limit: maxProjects },
        },
        flags: { overLimit, nearLimit },
        features,
      };
    });

    return {
      total: rows.length,
      overLimit: rows.filter((r) => r.flags.overLimit).length,
      nearLimit:  rows.filter((r) => r.flags.nearLimit  && !r.flags.overLimit).length,
      companies: rows,
    };
  }

  async cancelCompany(id: string, dto: CancelCompanyDto) {
    const company = await this.assertExists(id);
    if (company.subscriptionStatus === 'CANCELLED') {
      throw new BadRequestException('Company subscription is already cancelled');
    }

    const now = new Date();
    // immediate=true → CANCELLED right now; false → CANCELLING (access until subscriptionEndAt)
    const newStatus: SubscriptionStatus = dto.immediate ? 'CANCELLED' : 'CANCELLING';

    const updated = await this.prisma.company.update({
      where: { id },
      data: {
        subscriptionStatus: newStatus,
        cancelledAt: now,
        cancelReason: dto.reason ?? null,
        // If immediate, close the end date to now so the cron doesn't flip it again
        ...(dto.immediate && { subscriptionEndAt: now }),
      },
    });
    await this.notifyCompanyAdmins(id, 'subscription_cancelled', {
      endDate: dto.immediate ? isoDay(now) : isoDay(updated.subscriptionEndAt),
    });
    return updated;
  }

  async suspendCompany(id: string, reason?: string) {
    await this.assertExists(id);
    const updated = await this.prisma.company.update({
      where: { id },
      data: { subscriptionStatus: 'SUSPENDED', cancelReason: reason ?? null },
    });
    await this.notifyCompanyAdmins(id, 'company_suspended');
    return updated;
  }

  async activateCompany(id: string) {
    const company = await this.assertExists(id);
    const updated = await this.prisma.company.update({
      where: { id },
      data: {
        subscriptionStatus: 'ACTIVE',
        isActive: true,
        cancelledAt: null,
        cancelReason: null,
        // If reactivating a previously cancelled company, push the end date forward
        ...(company.subscriptionStatus === 'CANCELLED' || company.subscriptionStatus === 'EXPIRED'
          ? {}
          : {}),
      },
    });
    await this.notifyCompanyAdmins(id, 'company_activated');
    return updated;
  }

  async createCompanyAdmin(companyId: string, dto: CreateCompanyAdminDto) {
    await this.assertExists(companyId);
    // Company-scoped duplicate check avoids leaking cross-tenant email existence.
    // The global DB unique constraint on User.email provides the final guarantee.
    const existing = await this.prisma.user.findFirst({ where: { email: dto.email, companyId } });
    if (existing) throw new ConflictException('A user with this email already exists in this company');
    const passwordHash = await argon2.hash(dto.password);
    const created = await this.prisma.user.create({
      data: {
        role: 'ADMIN',
        fullName: dto.fullName,
        email: dto.email,
        passwordHash,
        locale: 'ar',
        companyId,
      },
      select: { id: true, fullName: true, email: true, role: true, createdAt: true },
    });
    await this.welcome(companyId, created);
    return created;
  }

  // MT-033 — Create any staff user (role-parameterised) in a target company.
  // SUPER_ADMIN is not a valid target role; the DTO enum enforces this.
  async createCompanyUser(companyId: string, dto: CreateCompanyUserDto) {
    await this.assertExists(companyId);
    const existing = await this.prisma.user.findFirst({ where: { email: dto.email, companyId } });
    if (existing) throw new ConflictException('A user with this email already exists in this company');
    // FG-21 — the target company's country, not the caller's: this runs in
    // the platform context on behalf of `companyId`.
    const phone = await phoneForWrite(this.prisma, dto.phone, companyId);
    const passwordHash = await argon2.hash(dto.password);
    const created = await this.prisma.user.create({
      data: {
        role: dto.role,
        fullName: dto.fullName,
        email: dto.email,
        phone: phone ?? null,
        passwordHash,
        locale: 'ar',
        companyId,
      },
      select: { id: true, fullName: true, email: true, role: true, phone: true, createdAt: true },
    });
    await this.welcome(companyId, created);
    return created;
  }

  /** Expire CANCELLING → CANCELLED and ACTIVE → EXPIRED based on subscriptionEndAt. */
  async runExpiryCheck(): Promise<{ expired: number; cancelled: number }> {
    const now = new Date();
    const due = (status: SubscriptionStatus) =>
      this.prisma.company.findMany({
        where: { subscriptionStatus: status, subscriptionEndAt: { lt: now } },
        select: { id: true },
      });
    const [toExpire, toCancel] = await Promise.all([due('ACTIVE'), due('CANCELLING')]);

    const [expired, cancelled] = await Promise.all([
      // ACTIVE past their end date → EXPIRED
      this.prisma.company.updateMany({
        where: {
          id: { in: toExpire.map((c) => c.id) },
          subscriptionStatus: 'ACTIVE',
          subscriptionEndAt: { lt: now },
        },
        data: { subscriptionStatus: 'EXPIRED' },
      }),
      // CANCELLING past their end date → CANCELLED
      this.prisma.company.updateMany({
        where: {
          id: { in: toCancel.map((c) => c.id) },
          subscriptionStatus: 'CANCELLING',
          subscriptionEndAt: { lt: now },
        },
        data: { subscriptionStatus: 'CANCELLED' },
      }),
    ]);

    for (const c of toExpire) await this.notifyCompanyAdmins(c.id, 'subscription_expired');
    for (const c of toCancel) await this.notifyCompanyAdmins(c.id, 'subscription_ended');
    await this.warnExpiringSoon(now);

    return { expired: expired.count, cancelled: cancelled.count };
  }

  /**
   * A week and a day before the end date, the company's admins are told.
   * The check runs once a day, so each one-day window is hit once.
   */
  private async warnExpiringSoon(now: Date) {
    const DAY = 24 * 60 * 60 * 1000;
    for (const daysLeft of [7, 1]) {
      const companies = await this.prisma.company.findMany({
        where: {
          subscriptionStatus: { in: ['ACTIVE', 'TRIAL', 'CANCELLING'] },
          subscriptionEndAt: {
            gt: new Date(now.getTime() + (daysLeft - 1) * DAY),
            lte: new Date(now.getTime() + daysLeft * DAY),
          },
        },
        select: { id: true, subscriptionEndAt: true },
      });
      for (const c of companies) {
        await this.notifyCompanyAdmins(c.id, 'subscription_expiring_soon', {
          daysLeft,
          endDate: isoDay(c.subscriptionEndAt),
        });
      }
    }
  }

  // ── Pricing ────────────────────────────────────────────────────────────────

  async listPricingPackages(companyId?: string) {
    return this.prisma.pricingPackage.findMany({
      where: companyId ? { companyId } : { companyId: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createPricingPackage(dto: CreatePricingPackageDto, companyId?: string) {
    return this.prisma.pricingPackage.create({
      data: {
        companyId: companyId ?? null,
        planTier: dto.planTier,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descAr: dto.descAr ?? null,
        descEn: dto.descEn ?? null,
        currency: dto.currency ?? 'SAR',
        monthlyPrice: dto.monthlyPrice ?? null,
        annualPrice: dto.annualPrice ?? null,
        setupFee: dto.setupFee ?? null,
        maxUsers: dto.maxUsers ?? null,
        highlights: dto.highlights ?? [],
        specialOffer: dto.specialOffer ?? Prisma.JsonNull,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updatePricingPackage(id: string, dto: UpdatePricingPackageDto) {
    const pkg = await this.prisma.pricingPackage.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException('Pricing package not found');
    return this.prisma.pricingPackage.update({
      where: { id },
      data: {
        ...(dto.planTier !== undefined && { planTier: dto.planTier }),
        ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
        ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
        ...(dto.descAr !== undefined && { descAr: dto.descAr }),
        ...(dto.descEn !== undefined && { descEn: dto.descEn }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.monthlyPrice !== undefined && { monthlyPrice: dto.monthlyPrice }),
        ...(dto.annualPrice !== undefined && { annualPrice: dto.annualPrice }),
        ...(dto.setupFee !== undefined && { setupFee: dto.setupFee }),
        ...(dto.maxUsers !== undefined && { maxUsers: dto.maxUsers }),
        ...(dto.highlights !== undefined && { highlights: dto.highlights }),
        ...(dto.specialOffer !== undefined && { specialOffer: dto.specialOffer ?? Prisma.JsonNull }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deletePricingPackage(id: string) {
    const pkg = await this.prisma.pricingPackage.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException('Pricing package not found');
    await this.prisma.pricingPackage.delete({ where: { id } });
  }

  // ── Modules ────────────────────────────────────────────────────────────────

  async getCompanyModules(id: string) {
    const company = await this.assertExists(id);
    const defaults = {
      broker: true, website: true, maintenance: true, reports: true,
      leads: true, visits: true, contracts: true, installments: true, deposits: true,
    };
    return { modules: { ...defaults, ...(company.modules as object ?? {}) } };
  }

  async updateCompanyModules(id: string, dto: UpdateCompanyModulesDto) {
    await this.assertExists(id);
    const updated = await this.prisma.company.update({
      where: { id },
      data: { modules: dto.modules },
      select: { id: true, modules: true },
    });
    return updated;
  }

  private async assertExists(id: string) {
    const c = await this.prisma.company.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Company not found');
    return c;
  }
}

function isoDay(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : '';
}
