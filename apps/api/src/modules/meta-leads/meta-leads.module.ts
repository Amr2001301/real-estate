import { Module } from '@nestjs/common';
import { LeadIntakeModule } from '../lead-intake/lead-intake.module';
import { MetaGraphClient } from './meta-graph.client';
import { MetaLeadsController } from './meta-leads.controller';
import { MetaLeadsService } from './meta-leads.service';

@Module({
  imports: [LeadIntakeModule],
  controllers: [MetaLeadsController],
  providers: [MetaLeadsService, MetaGraphClient],
})
export class MetaLeadsModule {}
