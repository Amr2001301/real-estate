import { Module } from '@nestjs/common';
import { CompanyDomainsController } from './company-domains.controller';
import { CompanyDomainsService } from './company-domains.service';
import { PublicDomainsController } from './public-domains.controller';

@Module({
  controllers: [CompanyDomainsController, PublicDomainsController],
  providers: [CompanyDomainsService],
  exports: [CompanyDomainsService],
})
export class CompanyDomainsModule {}
