import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/prisma/prisma.service';
import type {
  CreateCompanyDto,
  UpdateCompanyDto,
  CancelCompanyDto,
  CreateCompanyAdminDto,
  CreatePricingPackageDto,
  UpdatePricingPackageDto,
  UpdateCompanyModulesDto,
} from './dto/super-admin.dto';

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listCompanies() {
    const companies = await this.prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { users: true } } },
    });
    return companies.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      country: c.country,
      currency: c.currency,
      isActive: c.isActive,
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
        _count: { select: { users: true } },
        users: {
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
    return company;
  }

  async createCompany(dto: CreateCompanyDto) {
    const existing = await this.prisma.company.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('A company with this slug already exists');

    const company = await this.prisma.company.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        country: dto.country ?? 'SA',
        currency: dto.currency ?? 'SAR',
        timezone: dto.timezone ?? 'Asia/Riyadh',
        subscriptionPlan: dto.subscriptionPlan ?? 'TRIAL',
        subscriptionStatus: 'TRIAL',
        subscriptionStartAt: dto.subscriptionStartAt ? new Date(dto.subscriptionStartAt) : null,
        subscriptionEndAt: dto.subscriptionEndAt ? new Date(dto.subscriptionEndAt) : null,
        maxUsers: dto.maxUsers ?? null,
      },
    });

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
    return this.prisma.company.update({
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
        ...(dto.maxUsers !== undefined && { maxUsers: dto.maxUsers }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async cancelCompany(id: string, dto: CancelCompanyDto) {
    const company = await this.assertExists(id);
    if (company.subscriptionStatus === 'CANCELLED') {
      throw new BadRequestException('Company subscription is already cancelled');
    }

    const now = new Date();
    // immediate=true → CANCELLED right now; false → CANCELLING (access until subscriptionEndAt)
    const newStatus: SubscriptionStatus = dto.immediate ? 'CANCELLED' : 'CANCELLING';

    return this.prisma.company.update({
      where: { id },
      data: {
        subscriptionStatus: newStatus,
        cancelledAt: now,
        cancelReason: dto.reason ?? null,
        // If immediate, close the end date to now so the cron doesn't flip it again
        ...(dto.immediate && { subscriptionEndAt: now }),
      },
    });
  }

  async suspendCompany(id: string, reason?: string) {
    await this.assertExists(id);
    return this.prisma.company.update({
      where: { id },
      data: { subscriptionStatus: 'SUSPENDED', cancelReason: reason ?? null },
    });
  }

  async activateCompany(id: string) {
    const company = await this.assertExists(id);
    return this.prisma.company.update({
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
  }

  async createCompanyAdmin(companyId: string, dto: CreateCompanyAdminDto) {
    await this.assertExists(companyId);
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('A user with this email already exists');
    const passwordHash = await argon2.hash(dto.password);
    return this.prisma.user.create({
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
  }

  /** Expire CANCELLING → CANCELLED and ACTIVE → EXPIRED based on subscriptionEndAt. */
  async runExpiryCheck(): Promise<{ expired: number; cancelled: number }> {
    const now = new Date();

    const [expired, cancelled] = await Promise.all([
      // ACTIVE past their end date → EXPIRED
      this.prisma.company.updateMany({
        where: {
          subscriptionStatus: 'ACTIVE',
          subscriptionEndAt: { lt: now },
        },
        data: { subscriptionStatus: 'EXPIRED' },
      }),
      // CANCELLING past their end date → CANCELLED
      this.prisma.company.updateMany({
        where: {
          subscriptionStatus: 'CANCELLING',
          subscriptionEndAt: { lt: now },
        },
        data: { subscriptionStatus: 'CANCELLED' },
      }),
    ]);

    return { expired: expired.count, cancelled: cancelled.count };
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
