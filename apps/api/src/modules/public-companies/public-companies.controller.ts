/**
 * MT-056 / MT-057 — Public Company discovery controller.
 *
 * Two narrow endpoints for the shared customer mobile app:
 *
 *   GET /v1/public/companies/search?q=...  — search eligible Companies
 *   GET /v1/public/companies/resolve?slug= — exact resolve by slug
 *
 * Both are @PlatformPublic (no JWT required). No companyId is returned.
 * Rate limited tighter than the platform default (30 req/min vs 100).
 */

import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PlatformPublic } from '../../common/decorators/platform-public.decorator';
import { PublicCompaniesService } from './public-companies.service';

const MIN_Q = 2;
const MAX_Q = 100;

@ApiTags('public-companies')
@Controller('public/companies')
export class PublicCompaniesController {
  constructor(private readonly service: PublicCompaniesService) {}

  /**
   * MT-056 — Public Company search.
   *
   * Returns at most 10 eligible Companies matching the query (name or slug).
   * Intentional enumeration — discovery is the designed purpose.
   * Response: [{ slug, name }]. No companyId, no capabilities, no billing.
   */
  @PlatformPublic()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get('search')
  async search(@Query('q') q?: string) {
    if (!q || q.trim().length < MIN_Q) {
      throw new BadRequestException({
        message: `q must be at least ${MIN_Q} characters`,
        code: 'QUERY_TOO_SHORT',
      });
    }
    if (q.length > MAX_Q) {
      throw new BadRequestException({
        message: `q must not exceed ${MAX_Q} characters`,
        code: 'QUERY_TOO_LONG',
      });
    }

    return this.service.search(q);
  }

  /**
   * MT-057 — Exact Company resolve.
   *
   * Returns { slug, name } when an eligible Company matches the slug exactly.
   * Unknown, inactive, or customer-app-disabled slugs all return 404 with the
   * same generic code — failure reason is not revealed to anonymous callers.
   */
  @PlatformPublic()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get('resolve')
  async resolve(@Query('slug') slug?: string) {
    if (!slug || slug.trim().length === 0) {
      throw new BadRequestException({
        message: 'slug query parameter is required',
        code: 'SLUG_REQUIRED',
      });
    }

    const result = await this.service.resolveBySlug(slug);
    if (!result) {
      throw new NotFoundException({
        message: 'Company not available',
        code: 'COMPANY_NOT_AVAILABLE',
      });
    }

    return result;
  }
}
