import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query, DefaultValuePipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ListingKind, ListingStatus, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { parseEnumList } from '../../common/utils/query-filters';
import { ListingsService } from './listings.service';
import { CreateListingDto, ListingPhotoPresignDto, SetListingStatusDto, UpdateListingDto } from './dto/listing.dto';

/**
 * BRK-2 — a brokerage company's listings. Open to brokerage companies only
 * (CompanyTypeGuard); every staff role sees the company's listings, agents
 * add and edit them, and only the admin or a sales manager deletes one.
 */
@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Permissions('listings:read')
  @Get()
  list(
    @Query('kind') kind?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('agentId', new ParseUUIDPipe({ optional: true })) agentId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('pageSize', new DefaultValuePipe(24), ParseIntPipe) pageSize?: number,
  ) {
    return this.listings.list({
      kind: parseEnumList(kind, ListingKind, 'kind'),
      status: parseEnumList(status, ListingStatus, 'status'),
      q,
      agentId,
      page,
      pageSize,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Permissions('listings:manage')
  @Post('photos/presign')
  presignPhoto(@Body() dto: ListingPhotoPresignDto) {
    return this.listings.presignPhoto(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Permissions('listings:read')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.listings.get(id);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Permissions('listings:manage')
  @Post()
  create(@Body() dto: CreateListingDto, @CurrentUser() user: AuthUser) {
    return this.listings.create(dto, user.sub);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Permissions('listings:manage')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateListingDto) {
    return this.listings.update(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Permissions('listings:manage')
  @Patch(':id/status')
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetListingStatusDto) {
    return this.listings.setStatus(id, dto.status);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('listings:manage')
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.listings.remove(id);
  }
}
