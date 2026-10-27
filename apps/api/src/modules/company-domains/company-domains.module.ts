import { Module } from '@nestjs/common';
import { CompanyDomainsAdminController, CompanyDomainsController } from './company-domains.controller';
import { CompanyDomainsService } from './company-domains.service';
import { PublicDomainsController } from './public-domains.controller';
import { VercelDomainsClient } from './vercel-domains.client';
import { DomainCheckCron } from './domain-check.cron';

@Module({
  controllers: [CompanyDomainsController, CompanyDomainsAdminController, PublicDomainsController],
  providers: [CompanyDomainsService, VercelDomainsClient, DomainCheckCron],
  exports: [CompanyDomainsService],
})
export class CompanyDomainsModule {}
