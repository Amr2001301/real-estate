import { Module } from '@nestjs/common';
import { UnitsService } from './units.service';
import { UnitsController } from './units.controller';
import { UnitTypesService } from './unit-types.service';

@Module({
  controllers: [UnitsController],
  providers: [UnitsService, UnitTypesService],
  exports: [UnitsService, UnitTypesService],
})
export class UnitsModule {}
