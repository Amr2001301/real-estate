/**
 * MT-025 — Tenant Identity Resolver.
 *
 * Centralises slug → Company resolution so auth methods do not duplicate the
 * lookup logic. The resolver performs a server-side DB query, validates the
 * slug, and returns a minimal trusted object. Clients never supply companyId
 * directly; the server derives it from the slug.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface ResolvedTenant {
  companyId: string;
  slug: string;
  country: string;
  isActive: boolean;
  lifecycleStatus: string;
}

@Injectable()
export class TenantResolverService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve a company by its slug.
   *
   * - Normalises the slug (lowercase trim) consistent with Company.slug storage.
   * - Queries server-side — the client's supplied slug is never trusted as an id.
   * - Throws NotFoundException (non-leaking: does not distinguish "inactive" from
   *   "not found") if the company does not exist or has isActive=false.
   * - Returns only the fields required for auth decisions.
   *
   * @param slug  The Company.slug value from the X-Tenant-Slug header or request body.
   */
  async resolveBySlug(slug: string): Promise<ResolvedTenant> {
    const normalizedSlug = slug.trim().toLowerCase();

    const company = await this.prisma.company.findUnique({
      where: { slug: normalizedSlug },
      select: { id: true, slug: true, country: true, isActive: true, lifecycleStatus: true },
    });

    // Inactive companies behave identically to non-existent ones — do not leak state.
    // Note: lifecycleStatus is returned but NOT gated here; auth callers independently
    // enforce COMPANY_NOT_ACTIVE. Public-path callers gate on lifecycleStatus === 'ACTIVE'.
    if (!company || !company.isActive) {
      throw new NotFoundException('Company not found');
    }

    return {
      companyId: company.id,
      slug: company.slug,
      country: company.country ?? 'SA',
      isActive: company.isActive,
      lifecycleStatus: company.lifecycleStatus,
    };
  }

  /**
   * Same as resolveBySlug but returns null instead of throwing when the slug
   * cannot be resolved. Use in the authenticated-mismatch interceptor path where
   * throwing a NotFoundException is the caller's responsibility.
   */
  async tryResolveBySlug(slug: string): Promise<ResolvedTenant | null> {
    try {
      return await this.resolveBySlug(slug);
    } catch {
      return null;
    }
  }
}
