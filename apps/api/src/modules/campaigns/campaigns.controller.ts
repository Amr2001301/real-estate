import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CampaignChannel, CampaignStatus, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { parseEnumList } from '../../common/utils/query-filters';
import { CampaignsService } from './campaigns.service';
import { AddCampaignSpendDto, CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

/** Marketing campaigns: the admin runs them; sales managers see how they do; reps pick one on a lead. */
@ApiTags('campaigns')
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('leads:read')
  @Get()
  list(@Query('status') status?: string, @Query('channel') channel?: string, @Query('projectId') projectId?: string) {
    const one = <T extends string>(v: string | undefined, e: Record<string, T>, name: string) => {
      const list = parseEnumList(v, e, name);
      return Array.isArray(list) ? list[0] : list;
    };
    return this.campaigns.list({
      status: one(status, CampaignStatus, 'status'),
      channel: one(channel, CampaignChannel, 'channel'),
      projectId: projectId || undefined,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER)
  @Permissions('leads:read')
  @Get('options')
  options() {
    return this.campaigns.options();
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('leads:read')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaigns.get(id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('campaigns:manage')
  @Post()
  create(@Body() dto: CreateCampaignDto) {
    return this.campaigns.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('campaigns:manage')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaigns.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('campaigns:manage')
  @Post(':id/spend')
  addSpend(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddCampaignSpendDto, @CurrentUser() user: AuthUser) {
    return this.campaigns.addSpend(id, dto, user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('campaigns:manage')
  @Delete(':id/spend/:spendId')
  removeSpend(@Param('id', ParseUUIDPipe) id: string, @Param('spendId', ParseUUIDPipe) spendId: string) {
    return this.campaigns.removeSpend(id, spendId);
  }
}
