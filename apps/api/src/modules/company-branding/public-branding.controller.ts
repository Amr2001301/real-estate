/**
 * MT-055 — Public branding endpoint.
 *
 * GET /v1/public/branding?slug=<slug>
 * GET /v1/public/branding?hostname=<hostname>
 *
 * Exactly one of slug or hostname is required. Supplying both is a 400.
 *
 * @PlatformPublic — no JWT required.
 * Rate limited to 30 req/min (same as other public endpoints).
 *
 * Response: CompanyBrandingResponse with null fields omitted.
 * Unknown slug or hostname → 404 with COMPANY_NOT_FOUND.
 * Unverified or inactive company → 404 (same code — no information leak).
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
import { CompanyBrandingService } from './company-branding.service';
import { InvalidHostnameError } from '../../common/utils/hostname-normalize';

@ApiTags('public-branding')
@Controller('public/branding')
export class PublicBrandingController {
  constructor(private readonly service: CompanyBrandingService) {}

  @PlatformPublic()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get()
  async getBranding(
    @Query('slug') slug?: string,
    @Query('hostname') hostname?: string,
  ) {
    const hasSlug     = slug     != null && slug.trim().length > 0;
    const hasHostname = hostname != null && hostname.trim().length > 0;

    if (!hasSlug && !hasHostname) {
      throw new BadRequestException({
        message: 'Provide exactly one of: slug, hostname',
        code: 'LOOKUP_PARAM_REQUIRED',
      });
    }

    if (hasSlug && hasHostname) {
      throw new BadRequestException({
        message: 'Provide exactly one of: slug, hostname — not both',
        code: 'LOOKUP_PARAM_AMBIGUOUS',
      });
    }

    try {
      const result = hasSlug
        ? await this.service.getBySlug(slug!)
        : await this.service.getByHostname(hostname!);

      if (!result) {
        throw new NotFoundException({
          message: 'Company not found',
          code: 'COMPANY_NOT_FOUND',
        });
      }

      return result;
    } catch (err) {
      if (err instanceof InvalidHostnameError) {
        throw new BadRequestException({
          message: 'Invalid hostname',
          code: 'HOSTNAME_INVALID',
        });
      }
      throw err;
    }
  }
}
