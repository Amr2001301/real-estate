import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { BrokerContractsService } from './broker-contracts.service';
import { BrokerContractsQueryDto } from './dto/broker-contract.dto';

@ApiTags('broker-contracts')
@Controller('broker-contracts')
export class BrokerContractsController {
  constructor(private readonly svc: BrokerContractsService) {}

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('broker_contracts:read')
  @Get()
  list(
    @Query() query: BrokerContractsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.list(query, user);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('broker_contracts:read')
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.findOne(id, user);
  }
}
