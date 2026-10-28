import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { GrantedBy } from '../../common/decorators/granted-by.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { BrokerAccessService } from './broker-access.service';
import {
  GrantBrokerProjectAccessDto,
  GrantBrokerUnitAccessDto,
} from './dto/broker-access.dto';

@ApiTags('broker-access')
@RequireCapability('feature.brokers')
@Controller()
export class BrokerAccessController {
  constructor(private readonly access: BrokerAccessService) {}

  @Roles(UserRole.ADMIN)
  @GrantedBy('broker_access:read')
  @Permissions('broker_access:read')
  @Get('brokers/:id/access')
  list(@Param('id', ParseUUIDPipe) brokerId: string) {
    return this.access.listAccess(brokerId);
  }

  @Roles(UserRole.ADMIN)
  @GrantedBy('broker_access:manage')
  @Permissions('broker_access:manage')
  @Post('brokers/:id/access/projects')
  grantProject(
    @Param('id', ParseUUIDPipe) brokerId: string,
    @Body() dto: GrantBrokerProjectAccessDto,
  ) {
    return this.access.grantProject(brokerId, dto);
  }

  @Roles(UserRole.ADMIN)
  @GrantedBy('broker_access:manage')
  @Permissions('broker_access:manage')
  @Delete('brokers/:id/access/projects/:projectId')
  revokeProject(
    @Param('id', ParseUUIDPipe) brokerId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.access.revokeProject(brokerId, projectId);
  }

  @Roles(UserRole.ADMIN)
  @GrantedBy('broker_access:manage')
  @Permissions('broker_access:manage')
  @Post('brokers/:id/access/units')
  grantUnit(
    @Param('id', ParseUUIDPipe) brokerId: string,
    @Body() dto: GrantBrokerUnitAccessDto,
  ) {
    return this.access.grantUnit(brokerId, dto);
  }

  @Roles(UserRole.ADMIN)
  @GrantedBy('broker_access:manage')
  @Permissions('broker_access:manage')
  @Delete('brokers/:id/access/units/:unitId')
  revokeUnit(
    @Param('id', ParseUUIDPipe) brokerId: string,
    @Param('unitId', ParseUUIDPipe) unitId: string,
  ) {
    return this.access.revokeUnit(brokerId, unitId);
  }
}
