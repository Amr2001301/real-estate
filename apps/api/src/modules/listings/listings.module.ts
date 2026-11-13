import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { UnitsModule } from '../units/units.module';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

@Module({
  imports: [UnitsModule, MediaModule],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
