import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChequeLifecycleService } from './payment-instruments.service';
import { PaymentInstrumentsController } from './payment-instruments.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [PaymentInstrumentsController],
  providers: [ChequeLifecycleService],
  exports: [ChequeLifecycleService],
})
export class PaymentInstrumentsModule {}
