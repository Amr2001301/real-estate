import { Module } from '@nestjs/common';
import { UnitsService } from './units.service';
import { UnitsController } from './units.controller';
import { UnitTypesService } from './unit-types.service';
import { UnitModelsService } from './unit-models.service';
import { DeliveryDelaysService } from './delivery-delays.service';
import { UnitValueService } from './unit-value.service';
import { MeUnitValuesController, ProjectPriceRatesController } from './unit-value.controller';
import { UnitValueRiseCron } from './unit-value-rise.cron';

@Module({
  controllers: [UnitsController, ProjectPriceRatesController, MeUnitValuesController],
  providers: [UnitsService, UnitTypesService, UnitModelsService, DeliveryDelaysService, UnitValueService, UnitValueRiseCron],
  exports: [UnitsService, UnitTypesService, UnitModelsService, DeliveryDelaysService, UnitValueService],
})
export class UnitsModule {}
