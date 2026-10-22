import { Module } from '@nestjs/common';
import { CustomerFieldsController } from './customer-fields.controller';
import { CustomerFieldsService } from './customer-fields.service';

@Module({
  controllers: [CustomerFieldsController],
  providers: [CustomerFieldsService],
  exports: [CustomerFieldsService],
})
export class CustomerFieldsModule {}
