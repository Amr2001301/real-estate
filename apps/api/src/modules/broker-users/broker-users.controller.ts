import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { BrokerUsersService } from './broker-users.service';
import {
  CreateBrokerUserDto,
  UpdateBrokerUserDto,
  UpdateBrokerUserStatusDto,
} from './dto/broker-user.dto';

@ApiTags('broker-users')
@Controller()
export class BrokerUsersController {
  constructor(private readonly brokerUsers: BrokerUsersService) {}

  @Roles(UserRole.ADMIN)
  @Get('brokers/:id/users')
  listByBroker(@Param('id', ParseUUIDPipe) brokerId: string) {
    return this.brokerUsers.listByBroker(brokerId);
  }

  @Roles(UserRole.ADMIN)
  @Post('brokers/:id/users')
  create(
    @Param('id', ParseUUIDPipe) brokerId: string,
    @Body() dto: CreateBrokerUserDto,
  ) {
    return this.brokerUsers.create(brokerId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch('broker-users/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBrokerUserDto,
  ) {
    return this.brokerUsers.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch('broker-users/:id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBrokerUserStatusDto,
  ) {
    return this.brokerUsers.updateStatus(id, dto);
  }
}
