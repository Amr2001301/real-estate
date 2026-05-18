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
import { BrokersService } from './brokers.service';
import {
  CreateBrokerDto,
  UpdateBrokerDto,
  UpdateBrokerStatusDto,
} from './dto/broker.dto';

@ApiTags('brokers')
@Controller('brokers')
export class BrokersController {
  constructor(private readonly brokers: BrokersService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateBrokerDto) {
    return this.brokers.create(dto);
  }

  @Roles(UserRole.ADMIN)
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
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.brokers.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBrokerDto,
  ) {
    return this.brokers.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBrokerStatusDto,
  ) {
    return this.brokers.updateStatus(id, dto);
  }
}
