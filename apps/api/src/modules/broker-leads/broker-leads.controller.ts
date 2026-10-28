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
import {
  Permissions,
  PermissionsStrict,
} from '../../common/decorators/permissions.decorator';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { salesDataScope } from '../../common/permissions/company-wide';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { BrokerLeadsService } from './broker-leads.service';
import {
  ApproveBrokerLeadDto,
  BrokerLeadsQueryDto,
  MarkBrokerLeadDuplicateDto,
  RejectBrokerLeadDto,
} from './dto/broker-lead.dto';

@ApiTags('broker-leads')
@RequireCapability('feature.brokers')
@Controller('broker-leads')
export class BrokerLeadsController {
  constructor(
    private readonly brokerLeads: BrokerLeadsService,
    private readonly prisma: PrismaService,
  ) {}

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('broker_leads:read')
  @Get()
  async list(@Query() query: BrokerLeadsQueryDto, @CurrentUser() user: AuthUser) {
    // PRM2 — leads keep their scope (rule 2): a rep the broker leads assigned
    // to them, a manager their team's; the admin all (and the queue to approve).
    return this.brokerLeads.list(query, await salesDataScope(this.prisma, user));
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('broker_leads:read')
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.brokerLeads.findOne(id, await salesDataScope(this.prisma, user));
  }

  @Roles(UserRole.ADMIN)
  @PermissionsStrict('broker_leads:approve')
  @Patch(':id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveBrokerLeadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.brokerLeads.approve(id, dto, user);
  }

  @Roles(UserRole.ADMIN)
  @PermissionsStrict('broker_leads:reject')
  @Patch(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectBrokerLeadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.brokerLeads.reject(id, dto, user);
  }

  // mark-duplicate transitions the lead into the terminal DUPLICATE state
  // (clears approval, stores a rejection reason) — a rejection variant, so it
  // reuses broker_leads:reject rather than introducing a new code.
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('broker_leads:reject')
  @Patch(':id/mark-duplicate')
  markDuplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkBrokerLeadDuplicateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.brokerLeads.markDuplicate(id, dto, user);
  }
}
