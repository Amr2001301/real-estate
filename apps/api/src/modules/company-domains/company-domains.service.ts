/**
 * MT-049 / MT-050 — CompanyDomainsService
 *
 * Manages custom domains (and exposes platform subdomains) for a tenant.
 * Security invariants:
 *  - companyId ALWAYS comes from req.user.companyId (JWT-authoritative DB value).
 *  - Cross-company reads return 404 (not 403) to avoid enumeration.
 *  - Platform subdomains (type=PLATFORM_SUBDOMAIN) cannot be deleted.
 *  - Only verified custom domains can be set as primary.
 *  - Reserved platform namespace (*.PLATFORM_BASE_DOMAIN) blocked for custom domains.
 *  - Hostname normalization applied before every DB read/write.
 *
 * Cache invalidation: called after create, delete, verify, primary change.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import * as dns from 'node:dns/promises';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DomainResolverService } from '../../common/domain/domain-resolver.service';
import { normalizeHostname, InvalidHostnameError } from '../../common/utils/hostname-normalize';
import type { AppEnv } from '../../config/env.validation';

function generateVerificationToken(): string {
  return randomBytes(24).toString('hex');
}

// Slugs that cannot be used for company subdomains: they collide with platform services.
// www → normalizes away, overwriting the base domain itself.
// api → {PLATFORM_BASE_DOMAIN} API service hostname.
// admin → web-admin service hostname.
export const RESERVED_PLATFORM_SLUGS = new Set(['www', 'api', 'admin']);

@Injectable()
export class CompanyDomainsService {
  private readonly logger = new Logger(CompanyDomainsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: DomainResolverService,
    private readonly config: ConfigService<AppEnv>,
  ) {}

  async list(companyId: string) {
    return this.prisma.companyDomain.findMany({
      where: { companyId },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        hostname: true,
        type: true,
        isPrimary: true,
        verifiedAt: true,
        verificationToken: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createCustom(companyId: string, rawHostname: string) {
    let hostname: string;
    try {
      hostname = normalizeHostname(rawHostname);
    } catch (err) {
      if (err instanceof InvalidHostnameError) throw err;
      throw new BadRequestException('Invalid hostname');
    }

    this.assertNotPlatformNamespace(hostname);

    const existing = await this.prisma.companyDomain.findUnique({ where: { hostname } });
    if (existing) {
      throw new ConflictException({ message: 'Hostname is already registered', code: 'DOMAIN_ALREADY_REGISTERED' });
    }

    const token = generateVerificationToken();
    let domain;
    try {
      domain = await this.prisma.companyDomain.create({
        data: {
          companyId,
          hostname,
          type: 'CUSTOM',
          isPrimary: false,
          verifiedAt: null,
          verificationToken: token,
        },
        select: {
          id: true,
          hostname: true,
          type: true,
          isPrimary: true,
          verifiedAt: true,
          verificationToken: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (err) {
      // P2002: concurrent request claimed the same hostname between our findUnique and create
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ message: 'Hostname is already registered', code: 'DOMAIN_ALREADY_REGISTERED' });
      }
      throw err;
    }

    return domain;
  }

  async delete(companyId: string, domainId: string) {
    const domain = await this.prisma.companyDomain.findUnique({
      where: { id: domainId },
      select: { id: true, companyId: true, type: true, hostname: true, isPrimary: true },
    });

    if (!domain || domain.companyId !== companyId) {
      throw new NotFoundException('Domain not found');
    }

    if (domain.type === 'PLATFORM_SUBDOMAIN') {
      throw new ForbiddenException({
        message: 'Platform subdomain cannot be deleted',
        code: 'PLATFORM_SUBDOMAIN_DELETE_FORBIDDEN',
      });
    }

    if (domain.isPrimary) {
      // Revert primary to the platform subdomain
      const platformDomain = await this.prisma.companyDomain.findFirst({
        where: { companyId, type: 'PLATFORM_SUBDOMAIN' },
        select: { id: true },
      });
      if (platformDomain) {
        await this.prisma.companyDomain.update({
          where: { id: platformDomain.id },
          data: { isPrimary: true },
        });
      }
    }

    await this.prisma.companyDomain.delete({ where: { id: domainId } });
    await this.resolver.invalidateHostname(domain.hostname);
  }

  async verify(companyId: string, domainId: string) {
    const domain = await this.prisma.companyDomain.findUnique({
      where: { id: domainId },
      select: {
        id: true,
        companyId: true,
        hostname: true,
        type: true,
        verificationToken: true,
        verifiedAt: true,
      },
    });

    if (!domain || domain.companyId !== companyId) {
      throw new NotFoundException('Domain not found');
    }

    if (domain.type === 'PLATFORM_SUBDOMAIN') {
      throw new BadRequestException({
        message: 'Platform subdomains are auto-verified and cannot be manually verified',
        code: 'PLATFORM_SUBDOMAIN_VERIFY_FORBIDDEN',
      });
    }

    if (domain.verifiedAt) {
      return { verified: true, hostname: domain.hostname };
    }

    const timeoutMs = this.config.get<number>('DOMAIN_DNS_TIMEOUT_MS') ?? 5000;
    const txtHost = `_host-verification.${domain.hostname}`;
    const expectedRecord = `verification=${domain.verificationToken}`;

    let verified = false;
    try {
      const records = await Promise.race([
        dns.resolveTxt(txtHost),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DNS timeout')), timeoutMs),
        ),
      ]);

      // records is string[][] — flatten inner arrays for multi-string TXT values
      for (const recordSet of records) {
        const joined = recordSet.join('');
        if (joined === expectedRecord) {
          verified = true;
          break;
        }
      }
    } catch {
      // NXDOMAIN, ENODATA, timeout — treat as not verified yet
    }

    if (verified) {
      await this.prisma.companyDomain.update({
        where: { id: domainId },
        data: { verifiedAt: new Date() },
      });
      await this.resolver.invalidateHostname(domain.hostname);
    }

    return { verified, hostname: domain.hostname };
  }

  async setPrimary(companyId: string, domainId: string) {
    const domain = await this.prisma.companyDomain.findUnique({
      where: { id: domainId },
      select: { id: true, companyId: true, hostname: true, type: true, verifiedAt: true, isPrimary: true },
    });

    if (!domain || domain.companyId !== companyId) {
      throw new NotFoundException('Domain not found');
    }

    if (!domain.verifiedAt && domain.type !== 'PLATFORM_SUBDOMAIN') {
      throw new BadRequestException({
        message: 'Custom domain must be verified before setting as primary',
        code: 'DOMAIN_NOT_VERIFIED',
      });
    }

    if (domain.isPrimary) return { id: domain.id, hostname: domain.hostname, isPrimary: true };

    // Clear current primary for this company, then set new one
    await this.prisma.$transaction([
      this.prisma.companyDomain.updateMany({
        where: { companyId, isPrimary: true },
        data: { isPrimary: false },
      }),
      this.prisma.companyDomain.update({
        where: { id: domainId },
        data: { isPrimary: true },
      }),
    ]);

    await this.resolver.invalidateAllForCompany(companyId);

    return { id: domain.id, hostname: domain.hostname, isPrimary: true };
  }

  // Called by SuperAdminService.createCompany() inside a $transaction — provisions the platform subdomain.
  // Accepts an optional tx (Prisma.TransactionClient) so the upsert participates in the caller's transaction.
  async provisionPlatformSubdomain(
    companyId: string,
    slug: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const baseDomain = this.config.get<string>('PLATFORM_BASE_DOMAIN');
    if (!baseDomain) {
      this.logger.warn(
        'PLATFORM_BASE_DOMAIN is not set — platform subdomain provisioning skipped. ' +
        'Every page on this tenant\'s public site will 404 until the domain is resolved. ' +
        'Set PLATFORM_BASE_DOMAIN in your environment, or set DEV_TENANT_SLUG for local/CI use.',
      );
      return;
    }

    const rawHostname = `${slug}.${baseDomain}`;
    let hostname: string;
    try {
      hostname = normalizeHostname(rawHostname);
    } catch {
      return; // Config error — don't fail company creation
    }

    // Fail-closed: if the slug collapses to the base domain itself (e.g. slug='www'),
    // provisioning MUST throw — a silent skip would hide the invariant violation from
    // callers (backfill, seed, direct calls). Primary protection is RESERVED_PLATFORM_SLUGS
    // in SuperAdminService.createCompany(), but this guard catches all call paths.
    const normalizedBase = baseDomain.trim().toLowerCase();
    if (hostname === normalizedBase) {
      throw new BadRequestException({
        message: `Slug "${slug}" is invalid — its subdomain collapses to the platform base domain`,
        code: 'PLATFORM_DOMAIN_INVALID',
      });
    }

    const db = tx ?? this.prisma;
    await db.companyDomain.upsert({
      where: { hostname },
      create: {
        companyId,
        hostname,
        type: 'PLATFORM_SUBDOMAIN',
        isPrimary: true,
        verifiedAt: new Date(),
        verificationToken: generateVerificationToken(),
      },
      update: {},
    });
  }

  private assertNotPlatformNamespace(hostname: string): void {
    const baseDomain = this.config.get<string>('PLATFORM_BASE_DOMAIN');
    if (!baseDomain) return;

    const normalizedBase = baseDomain.trim().toLowerCase();
    if (hostname === normalizedBase || hostname.endsWith(`.${normalizedBase}`)) {
      throw new ForbiddenException({
        message: `Custom domains under ${baseDomain} are reserved for platform use`,
        code: 'DOMAIN_RESERVED_NAMESPACE',
      });
    }
  }
}
