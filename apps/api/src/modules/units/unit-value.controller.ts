import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength, ValidateIf } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { UnitValueService } from './unit-value.service';

export class SetPriceRateDto {
  /** A unit type of the project; null or absent = the whole project. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(60)
  unitType?: string | null;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(100_000_000)
  pricePerMeter!: number;
}

/** A project's prices per meter: today's from the units for sale, and the company's own. */
@ApiTags('units')
@Controller('projects/:projectId/price-rates')
export class ProjectPriceRatesController {
  constructor(private readonly svc: UnitValueService) {}

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('units:read')
  @Get()
  list(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.projectRates(projectId);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('units:update')
  @Put()
  set(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: SetPriceRateDto, @CurrentUser() user: AuthUser) {
    return this.svc.setManualRate(projectId, dto.unitType?.trim() || null, dto.pricePerMeter, user?.sub);
  }
}

/** «قيمة وحدتك»: the customer's units valued today. */
@ApiTags('me-unit-values')
@RequireCapability('feature.customerApp')
@Controller('me/unit-values')
export class MeUnitValuesController {
  constructor(private readonly svc: UnitValueService) {}

  @Roles(UserRole.CUSTOMER)
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.svc.forCustomer(user.sub);
  }
}
