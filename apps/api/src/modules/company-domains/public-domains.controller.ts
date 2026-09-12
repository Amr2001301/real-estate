/**
 * MT-048 — Public domain resolution endpoint.
 *
 * GET /v1/public/domains/resolve?hostname=
 *
 * Returns minimal tenant metadata for a hostname. Used by:
 *   - Next.js hostname-based routing (future MT-051)
 *   - CDN/edge health checks
 *
 * @PlatformPublic: no JWT required. Response exposes only:
 *   { slug, hostname, websiteEnabled }
 * — no companyId, no billing, no capabilities.
 */

import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DomainResolverService } from '../../common/domain/domain-resolver.service';
import { PlatformPublic } from '../../common/decorators/platform-public.decorator';
import { InvalidHostnameError, normalizeHostname } from '../../common/utils/hostname-normalize';

@ApiTags('public-domains')
@Controller('public/domains')
export class PublicDomainsController {
  constructor(private readonly resolver: DomainResolverService) {}

  @PlatformPublic()
  @Get('resolve')
  async resolve(@Query('hostname') rawHostname?: string) {
    if (!rawHostname) {
      throw new BadRequestException({ message: 'hostname query parameter is required', code: 'HOSTNAME_REQUIRED' });
    }

    let hostname: string;
    try {
      hostname = normalizeHostname(rawHostname);
    } catch (err) {
      if (err instanceof InvalidHostnameError) throw err;
      throw new BadRequestException('Invalid hostname');
    }

    const result = await this.resolver.resolve(hostname);
    if (!result) {
      return null;
    }

    return {
      slug: result.slug,
      hostname: result.hostname,
      websiteEnabled: result.websiteEnabled,
    };
  }
}
