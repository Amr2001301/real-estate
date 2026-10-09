import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizeCurrency } from '../../common/currency/currency';
import {
  DEFAULT_ACCENT,
  DEFAULT_PRIMARY,
  fallbackBrand,
  imageExtension,
  type ReportBrand,
} from '../../common/utils/report-brand';
import { R2Service } from '../media/r2.service';

const TTL_MS = 5 * 60 * 1000;

/**
 * The company identity for generated report files. Cached per company for a
 * few minutes (a report run builds several files; the logo is a storage
 * read) and dropped on a branding change.
 */
@Injectable()
export class ReportBrandService {
  private readonly cache = new Map<string, { at: number; brand: ReportBrand }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  async forCompany(companyId: string | null | undefined): Promise<ReportBrand> {
    if (!companyId) return fallbackBrand();
    const hit = this.cache.get(companyId);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.brand;

    const c = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        displayName: true,
        logoUrl: true,
        primaryColor: true,
        accentColor: true,
        registrationNumber: true,
        contactPhone: true,
        contactEmail: true,
        currency: true,
      },
    });
    if (!c) return fallbackBrand();

    const image = await this.r2.readPublicImage(c.logoUrl);
    const extension = image ? imageExtension(image.buffer) : null;
    const brand: ReportBrand = {
      name: c.displayName || c.name,
      primary: c.primaryColor || DEFAULT_PRIMARY,
      accent: c.accentColor || DEFAULT_ACCENT,
      logo: image && extension ? { buffer: image.buffer, extension } : null,
      registrationNumber: c.registrationNumber ?? undefined,
      contactPhone: c.contactPhone ?? undefined,
      contactEmail: c.contactEmail ?? undefined,
      currency: normalizeCurrency(c.currency),
    };
    this.cache.set(companyId, { at: Date.now(), brand });
    return brand;
  }

  /** Called when the company's branding changes. */
  invalidate(companyId: string): void {
    this.cache.delete(companyId);
  }
}
