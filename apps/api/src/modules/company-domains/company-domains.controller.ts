/**
 * MT-049 — Tenant-facing domain management (ADMIN only).
 * Base path: /v1/company-domains
 *
 * companyId is NEVER accepted from the request body; always taken from req.user.
 */

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
import { CompanyDomainsService } from './company-domains.service';
import { CreateCustomDomainDto } from './dto/company-domains.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('company-domains')
@Controller('company-domains')
export class CompanyDomainsController {
  constructor(private readonly service: CompanyDomainsService) {}

  @Roles(UserRole.ADMIN)
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.companyId!);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomDomainDto) {
    return this.service.createCustom(user.companyId!, dto.hostname);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.delete(user.companyId!, id);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/verify')
  verify(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.verify(user.companyId!, id);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/primary')
  setPrimary(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.setPrimary(user.companyId!, id);
  }
}
