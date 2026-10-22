import { Module } from '@nestjs/common';
import { DocumentTemplatesController, PrintSettingsController } from './print-settings.controller';
import { PrintSettingsService } from './print-settings.service';
import { FormLayoutsController } from '../form-layouts/form-layouts.controller';
import { FormLayoutsService } from '../form-layouts/form-layouts.service';

@Module({
  controllers: [PrintSettingsController, DocumentTemplatesController, FormLayoutsController],
  providers: [PrintSettingsService, FormLayoutsService],
})
export class PrintSettingsModule {}
