import { Module } from '@nestjs/common';
import { UnitsService } from './units.service';
import { UnitsController } from './units.controller';
import { UnitTypesService } from './unit-types.service';
import { UnitModelsService } from './unit-models.service';

@Module({
  controllers: [UnitsController],
  providers: [UnitsService, UnitTypesService, UnitModelsService],
  exports: [UnitsService, UnitTypesService, UnitModelsService],
})
export class UnitsModule {}
