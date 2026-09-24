/**
 * MT-055 — CompanyBrandingService
 *
 * Resolves and caches public branding data for a Company by slug or hostname.
 *
 * Cache keys:
 *   company-branding:slug:{slug}         → response JSON, 300s TTL
 *   company-branding:hostname:{hostname} → response JSON, 300s TTL
 *
 * Invalidation: invalidate(companyId) fetches the company's slug and all
 * associated hostnames from the DB, then deletes the matching cache keys.
 * Slug/hostname ref entries that survive invalidation cause a cache miss on
 * the next request (primary key gone) and naturally repopulate from the DB.
 *
 * Guard rules:
 *   slug path     — lifecycleStatus = ACTIVE, isActive = true
 *   hostname path — same + verifiedAt IS NOT NULL on the CompanyDomain row
 *
 * Null branding fields are omitted from the response; only slug and name are
 * always present.
 */

import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizeHostname, InvalidHostnameError } from '../../common/utils/hostname-normalize';
import type { PatchCompanyBrandingDto } from './dto/patch-company-branding.dto';

export const BRANDING_CACHE_REDIS = Symbol('BRANDING_CACHE_REDIS');

const CACHE_TTL = 300; // seconds

const BRANDING_SELECT = {
  id: true,
  slug: true,
  name: true,
  displayName: true,
  logoUrl: true,
  faviconUrl: true,
  ogImageUrl: true,
  primaryColor: true,
  accentColor: true,
  tagline: true,
  contactEmail: true,
  contactPhone: true,
  contactWhatsApp: true,
  contactAddress: true,
  officeHours: true,
  socialLinks: true,
  registrationNumber: true,
} as const;

export interface CompanyBrandingResponse {
  slug: string;
  name: string;
  displayName?: string;
  logoUrl?: string;
  faviconUrl?: string;
  ogImageUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  tagline?: unknown;
  contactEmail?: string;
  contactPhone?: string;
  contactWhatsApp?: string;
  contactAddress?: unknown;
  officeHours?: unknown;
  socialLinks?: unknown;
  registrationNumber?: string;
}

type BrandingRow = {
  id: string;
  slug: string;
  name: string;
  displayName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  tagline: unknown;
  contactEmail: string | null;
  contactPhone: string | null;
  contactWhatsApp: string | null;
  contactAddress: unknown;
  officeHours: unknown;
  socialLinks: unknown;
  registrationNumber: string | null;
};

function buildResponse(row: BrandingRow): CompanyBrandingResponse {
  const res: CompanyBrandingResponse = { slug: row.slug, name: row.name };
  if (row.displayName != null)      res.displayName      = row.displayName;
  if (row.logoUrl != null)          res.logoUrl          = row.logoUrl;
  if (row.faviconUrl != null)       res.faviconUrl       = row.faviconUrl;
  if (row.ogImageUrl != null)       res.ogImageUrl       = row.ogImageUrl;
  if (row.primaryColor != null)     res.primaryColor     = row.primaryColor;
  if (row.accentColor != null)      res.accentColor      = row.accentColor;
  if (row.tagline != null)          res.tagline          = row.tagline;
  if (row.contactEmail != null)     res.contactEmail     = row.contactEmail;
  if (row.contactPhone != null)     res.contactPhone     = row.contactPhone;
  if (row.contactWhatsApp != null)  res.contactWhatsApp  = row.contactWhatsApp;
  if (row.contactAddress != null)   res.contactAddress   = row.contactAddress;
  if (row.officeHours != null)      res.officeHours      = row.officeHours;
  if (row.socialLinks != null)      res.socialLinks      = row.socialLinks;
  if (row.registrationNumber != null) res.registrationNumber = row.registrationNumber;
  return res;
}

@Injectable()
export class CompanyBrandingService {
  private readonly logger = new Logger(CompanyBrandingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(BRANDING_CACHE_REDIS) private readonly redis: Redis,
  ) {}

  async getBySlug(rawSlug: string): Promise<CompanyBrandingResponse | null> {
    const slug = rawSlug.trim().toLowerCase();
    const cacheKey = `company-branding:slug:${slug}`;

    const cached = await this.readCache(cacheKey);
    if (cached) return cached;

    const row = await this.prisma.company.findFirst({
      where: { slug, lifecycleStatus: 'ACTIVE', isActive: true },
      select: BRANDING_SELECT,
    });

    if (!row) return null;

    const response = buildResponse(row);
    await this.writeCache(cacheKey, response);
    return response;
  }

  async getByHostname(rawHostname: string): Promise<CompanyBrandingResponse | null> {
    let hostname: string;
    try {
      hostname = normalizeHostname(rawHostname);
    } catch (err) {
      if (err instanceof InvalidHostnameError) throw err;
      return null;
    }

    const cacheKey = `company-branding:hostname:${hostname}`;

    const cached = await this.readCache(cacheKey);
    if (cached) return cached;

    const domain = await this.prisma.companyDomain.findUnique({
      where: { hostname },
      select: {
        verifiedAt: true,
        company: { select: { ...BRANDING_SELECT, lifecycleStatus: true, isActive: true } },
      },
    });

    if (!domain) return null;
    if (!domain.verifiedAt) return null;
    if (domain.company.lifecycleStatus !== 'ACTIVE') return null;
    if (!domain.company.isActive) return null;

    const response = buildResponse(domain.company);
    await this.writeCache(cacheKey, response);
    return response;
  }

  /** Admin read — returns raw DB row (all nullable fields, not cached). */
  async getOwnBranding(companyId: string): Promise<BrandingRow> {
    const row = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: BRANDING_SELECT,
    });
    if (!row) throw new NotFoundException({ message: 'Company not found', code: 'COMPANY_NOT_FOUND' });
    return row;
  }

  /** Admin write — persists branding fields and invalidates cache. */
  async updateBranding(companyId: string, dto: PatchCompanyBrandingDto): Promise<BrandingRow> {
    const data: Record<string, unknown> = {};
    if (dto.displayName    !== undefined) data.displayName    = dto.displayName;
    if (dto.tagline        !== undefined) data.tagline        = dto.tagline;
    if (dto.logoUrl        !== undefined) data.logoUrl        = dto.logoUrl;
    if (dto.faviconUrl     !== undefined) data.faviconUrl     = dto.faviconUrl;
    if (dto.ogImageUrl     !== undefined) data.ogImageUrl     = dto.ogImageUrl;
    if (dto.primaryColor   !== undefined) data.primaryColor   = dto.primaryColor;
    if (dto.accentColor    !== undefined) data.accentColor    = dto.accentColor;
    if (dto.contactEmail   !== undefined) data.contactEmail   = dto.contactEmail;
    if (dto.contactPhone   !== undefined) data.contactPhone   = dto.contactPhone;
    if (dto.contactWhatsApp !== undefined) data.contactWhatsApp = dto.contactWhatsApp;
    if (dto.contactAddress !== undefined) data.contactAddress = dto.contactAddress;
    if (dto.officeHours    !== undefined) data.officeHours    = dto.officeHours;
    if (dto.socialLinks    !== undefined) data.socialLinks    = dto.socialLinks;
    if (dto.registrationNumber !== undefined) data.registrationNumber = dto.registrationNumber;

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data,
      select: BRANDING_SELECT,
    });

    await this.invalidate(companyId);
    return updated;
  }

  /**
   * Invalidate all branding cache entries for a company.
   * Called after admin writes.
   */
  async invalidate(companyId: string): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { slug: true },
    });

    const domains = await this.prisma.companyDomain.findMany({
      where: { companyId },
      select: { hostname: true },
    });

    const keys: string[] = [];
    if (company) keys.push(`company-branding:slug:${company.slug}`);
    for (const d of domains) keys.push(`company-branding:hostname:${d.hostname}`);

    if (keys.length === 0) return;

    try {
      await this.redis.del(...keys);
    } catch (err) {
      this.logger.warn(`Redis error on branding cache invalidation for company ${companyId}: ${(err as Error).message}`);
    }
  }

  private async readCache(key: string): Promise<CompanyBrandingResponse | null> {
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as CompanyBrandingResponse;
    } catch (err) {
      this.logger.warn(`Redis error on branding cache read for ${key}: ${(err as Error).message}`);
      return null;
    }
  }

  private async writeCache(key: string, value: CompanyBrandingResponse): Promise<void> {
    try {
      await this.redis.setex(key, CACHE_TTL, JSON.stringify(value));
    } catch (err) {
      this.logger.warn(`Redis error on branding cache write for ${key}: ${(err as Error).message}`);
    }
  }
}
