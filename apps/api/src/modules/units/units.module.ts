import { Module } from '@nestjs/common';
import { UnitsService } from './units.service';
import { UnitsController } from './units.controller';
import { UnitTypesService } from './unit-types.service';
import { UnitModelsService } from './unit-models.service';
import { DeliveryDelaysService } from './delivery-delays.service';

@Module({
  controllers: [UnitsController],
  providers: [UnitsService, UnitTypesService, UnitModelsService, DeliveryDelaysService],
  exports: [UnitsService, UnitTypesService, UnitModelsService, DeliveryDelaysService],
})
export class UnitsModule {}
