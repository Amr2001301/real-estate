import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { COMPANY_WIDE_CODES, ownedSalesIds } from '../../common/permissions/company-wide';
import type { ReqWithCodes } from '../../common/permissions/staff-codes';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { BrokerContractsService } from './broker-contracts.service';
import { BrokerContractsQueryDto } from './dto/broker-contract.dto';

@ApiTags('broker-contracts')
@RequireCapability('feature.brokers')
@Controller('broker-contracts')
export class BrokerContractsController {
  constructor(
    private readonly svc: BrokerContractsService,
    private readonly prisma: PrismaService,
  ) {}

  // PRM2 — a broker contract is a contract: a rep sees their own, a manager
  // their team's; ADMIN or contracts:read:all, the whole company's.
  private scope(user: AuthUser, req: ReqWithCodes) {
    return ownedSalesIds(this.prisma, req, user, COMPANY_WIDE_CODES.contracts);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('broker_contracts:read')
  @Get()
  async list(
    @Query() query: BrokerContractsQueryDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ReqWithCodes,
  ) {
    return this.svc.list(query, await this.scope(user, req));
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('broker_contracts:read')
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: ReqWithCodes,
  ) {
    return this.svc.findOne(id, await this.scope(user, req));
  }
}
