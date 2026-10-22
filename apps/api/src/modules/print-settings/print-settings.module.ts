import { Module } from '@nestjs/common';
import { DocumentTemplatesController, PrintSettingsController } from './print-settings.controller';
import { PrintSettingsService } from './print-settings.service';

@Module({
  controllers: [PrintSettingsController, DocumentTemplatesController],
  providers: [PrintSettingsService],
})
export class PrintSettingsModule {}
