import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { BrokerLeadsService } from './broker-leads.service';
import {
  ApproveBrokerLeadDto,
  BrokerLeadsQueryDto,
  MarkBrokerLeadDuplicateDto,
  RejectBrokerLeadDto,
} from './dto/broker-lead.dto';

@ApiTags('broker-leads')
@Controller('broker-leads')
export class BrokerLeadsController {
  constructor(private readonly brokerLeads: BrokerLeadsService) {}

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get()
  list(@Query() query: BrokerLeadsQueryDto) {
    return this.brokerLeads.list(query);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.brokerLeads.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveBrokerLeadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.brokerLeads.approve(id, dto, user);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectBrokerLeadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.brokerLeads.reject(id, dto, user);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/mark-duplicate')
  markDuplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkBrokerLeadDuplicateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.brokerLeads.markDuplicate(id, dto, user);
  }
}
