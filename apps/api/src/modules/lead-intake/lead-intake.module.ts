import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LeadIntakeController } from './lead-intake.controller';
import { LeadIntakeService } from './lead-intake.service';

@Module({
  imports: [LeadsModule, NotificationsModule],
  controllers: [LeadIntakeController],
  providers: [LeadIntakeService],
})
export class LeadIntakeModule {}
