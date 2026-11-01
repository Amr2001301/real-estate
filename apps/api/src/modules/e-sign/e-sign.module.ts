import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CompanyBrandingModule } from '../company-branding/company-branding.module';
import { CustomerFieldsModule } from '../customer-fields/customer-fields.module';
import { PrintSettingsModule } from '../print-settings/print-settings.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { ESignController } from './e-sign.controller';
import { ESignService } from './e-sign.service';

@Module({
  imports: [
    AuthModule,
    ReservationsModule,
    CompanyBrandingModule,
    PrintSettingsModule,
    CustomerFieldsModule,
  ],
  controllers: [ESignController],
  providers: [ESignService],
})
export class ESignModule {}
