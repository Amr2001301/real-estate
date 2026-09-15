import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChequeLifecycleService } from './payment-instruments.service';
import { PaymentInstrumentsController } from './payment-instruments.controller';
import { ContractsModule } from '../contracts/contracts.module';

@Module({
  imports: [NotificationsModule, ContractsModule],
  controllers: [PaymentInstrumentsController],
  providers: [ChequeLifecycleService],
  exports: [ChequeLifecycleService],
})
export class PaymentInstrumentsModule {}
