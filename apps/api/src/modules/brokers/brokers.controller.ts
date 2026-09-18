import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BrokerStatus, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  Permissions,
  PermissionsStrict,
} from '../../common/decorators/permissions.decorator';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { BrokersService } from './brokers.service';
import {
  BrokerStatusReasonDto,
  CreateBrokerDto,
  UpdateBrokerDto,
  UpdateBrokerStatusDto,
} from './dto/broker.dto';

@ApiTags('brokers')
@RequireCapability('feature.brokers')
@Controller('brokers')
export class BrokersController {
  constructor(private readonly brokers: BrokersService) {}

  @Roles(UserRole.ADMIN)
  @Permissions('brokers:create')
  @Post()
  create(@Body() dto: CreateBrokerDto) {
    return this.brokers.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('brokers:read')
  @Get()
  findAll(
    @Query('status') status?: BrokerStatus,
    @Query('city') city?: string,
    @Query('q') q?: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.brokers.findAll({
      status,
      city,
      q,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  }

  @Roles(UserRole.ADMIN)
  @Permissions('brokers:read')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.brokers.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('brokers:update')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBrokerDto,
  ) {
    return this.brokers.update(id, dto);
  }

  // Non-destructive transitions only (reactivate → ACTIVE, back to PENDING).
  // The DTO whitelist rejects SUSPENDED/TERMINATED here; those are the
  // dedicated strict routes below.
  @Roles(UserRole.ADMIN)
  @Permissions('brokers:update')
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBrokerStatusDto,
  ) {
    return this.brokers.updateStatus(id, dto);
  }

  // Destructive transitions split into dedicated strict routes so each
  // carries its own permission code (even ADMIN must hold it).
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('brokers:suspend')
  @Post(':id/suspend')
  suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BrokerStatusReasonDto,
  ) {
    return this.brokers.suspend(id, dto.reason);
  }

  @Roles(UserRole.ADMIN)
  @PermissionsStrict('brokers:terminate')
  @Post(':id/terminate')
  terminate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BrokerStatusReasonDto,
  ) {
    return this.brokers.terminate(id, dto.reason);
  }
}
