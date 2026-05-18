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
import { Roles } from '../../common/decorators/roles.decorator';
import { BrokerAccessService } from './broker-access.service';
import {
  GrantBrokerProjectAccessDto,
  GrantBrokerUnitAccessDto,
} from './dto/broker-access.dto';

@ApiTags('broker-access')
@Controller()
export class BrokerAccessController {
  constructor(private readonly access: BrokerAccessService) {}

  @Roles(UserRole.ADMIN)
  @Get('brokers/:id/access')
  list(@Param('id', ParseUUIDPipe) brokerId: string) {
    return this.access.listAccess(brokerId);
  }

  @Roles(UserRole.ADMIN)
  @Post('brokers/:id/access/projects')
  grantProject(
    @Param('id', ParseUUIDPipe) brokerId: string,
    @Body() dto: GrantBrokerProjectAccessDto,
  ) {
    return this.access.grantProject(brokerId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete('brokers/:id/access/projects/:projectId')
  revokeProject(
    @Param('id', ParseUUIDPipe) brokerId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.access.revokeProject(brokerId, projectId);
  }

  @Roles(UserRole.ADMIN)
  @Post('brokers/:id/access/units')
  grantUnit(
    @Param('id', ParseUUIDPipe) brokerId: string,
    @Body() dto: GrantBrokerUnitAccessDto,
  ) {
    return this.access.grantUnit(brokerId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete('brokers/:id/access/units/:unitId')
  revokeUnit(
    @Param('id', ParseUUIDPipe) brokerId: string,
    @Param('unitId', ParseUUIDPipe) unitId: string,
  ) {
    return this.access.revokeUnit(brokerId, unitId);
  }
}
