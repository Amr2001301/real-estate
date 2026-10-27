/**
 * MT-049 / MT-050 — CompanyDomainsService
 *
 * Manages custom domains (and exposes platform subdomains) for a tenant —
 * from the super-admin routes; the tenant's own admin only lists them.
 * Security invariants:
 *  - companyId comes from req.user.companyId (tenant read) or the super-admin URL.
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
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import * as dns from 'node:dns/promises';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DomainResolverService } from '../../common/domain/domain-resolver.service';
import { normalizeHostname, InvalidHostnameError } from '../../common/utils/hostname-normalize';
import type { AppEnv } from '../../config/env.validation';
import { VercelDomainsClient, type VercelVerification } from './vercel-domains.client';

function generateVerificationToken(): string {
  return randomBytes(24).toString('hex');
}

// Slugs that cannot be used for company subdomains: they collide with platform services.
// www → normalizes away, overwriting the base domain itself.
// api → {PLATFORM_BASE_DOMAIN} API service hostname.
// admin → web-admin service hostname.
export const RESERVED_PLATFORM_SLUGS = new Set(['www', 'api', 'admin']);

/** Second-level suffixes a company domain sits under (example.com.eg is an apex). */
const MULTI_PART_SUFFIXES = new Set([
  'com.eg', 'net.eg', 'org.eg', 'edu.eg', 'gov.eg', 'sci.eg',
  'com.sa', 'net.sa', 'org.sa', 'co.ae', 'net.ae', 'org.ae', 'com.kw', 'com.qa', 'com.bh', 'com.om',
  'co.uk', 'org.uk', 'com.tr', 'com.jo', 'com.lb',
]);

/** The domain itself (example.com), not a sub-domain of it (www.example.com). */
export function isApexDomain(hostname: string): boolean {
  const labels = hostname.split('.');
  if (labels.length <= 2) return true;
  return labels.length === 3 && MULTI_PART_SUFFIXES.has(labels.slice(1).join('.'));
}

export interface DnsRecord {
  type: 'A' | 'CNAME' | 'TXT';
  /** The full name of the record (the DNS panel may want only the part before the domain). */
  name: string;
  value: string;
  purpose: 'routing' | 'ownership' | 'hosting';
}

/**
 * What the company adds at its DNS provider: one record pointing the domain
 * at the website's hosting, one TXT proving the domain is theirs, and any
 * record the hosting asks for.
 */
export function dnsRecords(hostname: string, token: string, hosting: VercelVerification[] = []): DnsRecord[] {
  const apex = isApexDomain(hostname);
  return [
    apex
      ? { type: 'A', name: hostname, value: '76.76.21.21', purpose: 'routing' }
      : { type: 'CNAME', name: hostname, value: 'cname.vercel-dns.com', purpose: 'routing' },
    // www.example.com is the same site (hostnames are stored without www).
    ...(apex ? [{ type: 'CNAME' as const, name: `www.${hostname}`, value: 'cname.vercel-dns.com', purpose: 'routing' as const }] : []),
    { type: 'TXT', name: `_host-verification.${hostname}`, value: `verification=${token}`, purpose: 'ownership' },
    ...hosting.map((v) => ({ type: v.type.toUpperCase() as DnsRecord['type'], name: v.domain, value: v.value, purpose: 'hosting' as const })),
  ];
}

/** The names served on the hosting: an apex domain with its www. */
export function hostingNames(hostname: string): string[] {
  return isApexDomain(hostname) ? [hostname, `www.${hostname}`] : [hostname];
}

const DOMAIN_SELECT = {
  id: true,
  hostname: true,
  type: true,
  isPrimary: true,
  verifiedAt: true,
  verificationToken: true,
  hostingStatus: true,
  hostingError: true,
  hostingCheckedAt: true,
  hostingRecords: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CompanyDomainSelect;

type DomainRow = Prisma.CompanyDomainGetPayload<{ select: typeof DOMAIN_SELECT }>;

/** A domain as the admin sees it: with the DNS records to add when it is custom. */
function present(d: DomainRow) {
  const hosting = Array.isArray(d.hostingRecords) ? (d.hostingRecords as unknown as VercelVerification[]) : [];
  return { ...d, dns: d.type === 'CUSTOM' ? dnsRecords(d.hostname, d.verificationToken, hosting) : [] };
}

@Injectable()
export class CompanyDomainsService {
  private readonly logger = new Logger(CompanyDomainsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: DomainResolverService,
    private readonly config: ConfigService<AppEnv>,
    @Optional() private readonly vercel?: VercelDomainsClient,
  ) {}

  private get hostingAutomated(): boolean {
    return !!this.vercel?.enabled;
  }

  /** 404 for a company that does not exist (super-admin routes take the id from the URL). */
  async assertCompany(companyId: string): Promise<void> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) throw new NotFoundException('Company not found');
  }

  async list(companyId: string) {
    const rows = await this.prisma.companyDomain.findMany({
      where: { companyId },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
      select: DOMAIN_SELECT,
    });
    return rows.map(present);
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
          hostingStatus: this.hostingAutomated ? 'PENDING' : null,
        },
        select: DOMAIN_SELECT,
      });
    } catch (err) {
      // P2002: concurrent request claimed the same hostname between our findUnique and create
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ message: 'Hostname is already registered', code: 'DOMAIN_ALREADY_REGISTERED' });
      }
      throw err;
    }

    // On the website's hosting right away, so it is served as soon as its DNS
    // points there. A failure is recorded and retried by the next check.
    if (this.hostingAutomated) {
      try {
        for (const name of hostingNames(hostname)) await this.vercel!.add(name);
      } catch (e) {
        domain = await this.prisma.companyDomain.update({
          where: { id: domain.id },
          data: { hostingStatus: 'ERROR', hostingError: (e as Error).message.slice(0, 500), hostingCheckedAt: new Date() },
          select: DOMAIN_SELECT,
        });
      }
    }

    return present(domain);
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
    // Off the website's hosting too; a failure leaves it there, harmless —
    // the hostname resolves to no company any more.
    if (this.hostingAutomated) {
      for (const name of hostingNames(domain.hostname)) {
        await this.vercel!.remove(name).catch((e) =>
          this.logger.warn(`Removing ${name} from the hosting failed: ${(e as Error).message}`),
        );
      }
    }
  }

  async verify(companyId: string, domainId: string) {
    const domain = await this.prisma.companyDomain.findUnique({
      where: { id: domainId },
      select: { companyId: true, type: true },
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

    const d = await this.refresh(domainId);
    return { verified: !!d.verifiedAt, hostname: d.hostname, domain: present(d) };
  }

  /** Whether the ownership TXT record is in place. */
  private async txtMatches(hostname: string, token: string): Promise<boolean> {
    const timeoutMs = this.config.get<number>('DOMAIN_DNS_TIMEOUT_MS') ?? 5000;
    const txtHost = `_host-verification.${hostname}`;
    const expectedRecord = `verification=${token}`;
    try {
      const records = await Promise.race([
        dns.resolveTxt(txtHost),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DNS timeout')), timeoutMs),
        ),
      ]);
      // records is string[][] — flatten inner arrays for multi-string TXT values
      return records.some((recordSet) => recordSet.join('') === expectedRecord);
    } catch {
      // NXDOMAIN, ENODATA, timeout — treat as not verified yet
      return false;
    }
  }

  /**
   * Re-checks a custom domain: its ownership TXT record (verified once, for
   * good) and, when the hosting is automated, its state there — on the
   * project, DNS pointing at it. Used by "verify" and by the periodic check.
   */
  private async refresh(domainId: string): Promise<DomainRow> {
    const d = await this.prisma.companyDomain.findUniqueOrThrow({ where: { id: domainId }, select: DOMAIN_SELECT });
    const data: Prisma.CompanyDomainUpdateInput = {};
    if (!d.verifiedAt && (await this.txtMatches(d.hostname, d.verificationToken))) data.verifiedAt = new Date();
    if (this.hostingAutomated) {
      try {
        // Ready when every name served (the domain, and www for an apex) is.
        const states = [];
        for (const name of hostingNames(d.hostname)) states.push(await this.vercel!.check(name));
        const verification = states
          .flatMap((st) => st.verification)
          .filter((v, i, all) => all.findIndex((o) => o.domain === v.domain && o.value === v.value) === i);
        data.hostingStatus = states.every((st) => st.verified && st.configured) ? 'READY' : 'PENDING';
        data.hostingError = null;
        data.hostingRecords = verification.length
          ? (verification as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull;
      } catch (e) {
        data.hostingStatus = 'ERROR';
        data.hostingError = (e as Error).message.slice(0, 500);
      }
      data.hostingCheckedAt = new Date();
    }
    if (Object.keys(data).length === 0) return d;
    const updated = await this.prisma.companyDomain.update({ where: { id: domainId }, data, select: DOMAIN_SELECT });
    if (data.verifiedAt || data.hostingStatus !== d.hostingStatus) await this.resolver.invalidateHostname(d.hostname);
    return updated;
  }

  /**
   * The periodic check: custom domains added in the last 14 days that are
   * not verified or not ready on the hosting yet, so the admin does not have
   * to come back and press "verify" once the DNS has spread.
   */
  async checkPending(): Promise<{ checked: number; verified: number; ready: number }> {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const pending = await this.prisma.companyDomain.findMany({
      where: {
        type: 'CUSTOM',
        createdAt: { gte: since },
        OR: [
          { verifiedAt: null },
          ...(this.hostingAutomated ? [{ hostingStatus: { not: 'READY' } }, { hostingStatus: null }] : []),
        ],
      },
      select: { id: true, verifiedAt: true, hostingStatus: true },
      take: 200,
    });
    let verified = 0;
    let ready = 0;
    for (const p of pending) {
      try {
        const d = await this.refresh(p.id);
        if (!p.verifiedAt && d.verifiedAt) verified++;
        if (p.hostingStatus !== 'READY' && d.hostingStatus === 'READY') ready++;
      } catch (e) {
        this.logger.warn(`Domain check ${p.id} failed: ${(e as Error).message}`);
      }
    }
    return { checked: pending.length, verified, ready };
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
