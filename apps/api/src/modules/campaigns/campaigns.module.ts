import { Module } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { CampaignReportService } from './campaign-report.service';

@Module({
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignReportService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
