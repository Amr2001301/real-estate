import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query, DefaultValuePipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ListingKind, ListingStatus, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { parseEnumList } from '../../common/utils/query-filters';
import { ListingsService } from './listings.service';
import { ListingTermsService } from './listing-terms.service';
import { ListingMatchingService } from './listing-matching.service';
import {
  CreateListingDto,
  CreateMandateDto,
  CreateTenancyDto,
  ListingPhotoPresignDto,
  RecordRentPaymentDto,
  SetListingStatusDto,
  SetRequirementDto,
  UpdateListingDto,
} from './dto/listing.dto';

/**
 * BRK-2 — a brokerage company's listings. Open to brokerage companies only
 * (CompanyTypeGuard); every staff role sees the company's listings, agents
 * add and edit them, and only the admin or a sales manager deletes one.
 */
@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listings: ListingsService,
    private readonly terms: ListingTermsService,
    private readonly matching: ListingMatchingService,
  ) {}

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

  /** Mandates ending soon, unpaid rent, tenancies ending soon — for the home page. */
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Permissions('listings:read')
  @Get('alerts')
  alerts() {
    return this.terms.alerts();
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
  async create(@Body() dto: CreateListingDto, @CurrentUser() user: AuthUser) {
    const listing = await this.listings.create(dto, user.sub);
    // BRK-5: tell the reps whose open leads it fits.
    await this.matching.announceListing(listing.id);
    return listing;
  }

  /** BRK-5 — what a lead is looking for (a rep: their own leads). */
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Permissions('listings:read')
  @Get('requirements/:leadId')
  getRequirement(@CurrentUser() user: AuthUser, @Param('leadId', ParseUUIDPipe) leadId: string) {
    return this.matching.getRequirement(user, leadId);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Permissions('listings:read')
  @Put('requirements/:leadId')
  setRequirement(@CurrentUser() user: AuthUser, @Param('leadId', ParseUUIDPipe) leadId: string, @Body() dto: SetRequirementDto) {
    return this.matching.setRequirement(user, leadId, dto);
  }

  /** The listings that fit a lead's requirements, best first. */
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Permissions('listings:read')
  @Get('matches/:leadId')
  matches(@CurrentUser() user: AuthUser, @Param('leadId', ParseUUIDPipe) leadId: string) {
    return this.matching.matchesForLead(user, leadId);
  }

  /** The caller's open leads a listing fits, best first. */
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Permissions('listings:read')
  @Get(':id/matching-leads')
  matchingLeads(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.matching.leadsForListing(user, id);
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

  // ─── Mandates and tenancies ────────────────────────────────────────────────

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Permissions('listings:read')
  @Get(':id/terms')
  listingTerms(@Param('id', ParseUUIDPipe) id: string) {
    return this.terms.terms(id);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Permissions('listings:manage')
  @Post(':id/mandates')
  createMandate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateMandateDto, @CurrentUser() user: AuthUser) {
    return this.terms.createMandate(id, dto, user.sub);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Permissions('listings:manage')
  @Post('mandates/:mandateId/cancel')
  cancelMandate(@Param('mandateId', ParseUUIDPipe) mandateId: string) {
    return this.terms.cancelMandate(mandateId);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Permissions('listings:manage')
  @Post(':id/tenancies')
  createTenancy(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateTenancyDto, @CurrentUser() user: AuthUser) {
    return this.terms.createTenancy(id, dto, user.sub);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Permissions('listings:manage')
  @Post('tenancies/:tenancyId/end')
  endTenancy(@Param('tenancyId', ParseUUIDPipe) tenancyId: string) {
    return this.terms.endTenancy(tenancyId);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Permissions('listings:manage')
  @Post('tenancies/:tenancyId/payments')
  recordPayment(@Param('tenancyId', ParseUUIDPipe) tenancyId: string, @Body() dto: RecordRentPaymentDto, @CurrentUser() user: AuthUser) {
    return this.terms.recordPayment(tenancyId, dto, user.sub);
  }

  /** Undo a payment entered by mistake: the admin or a sales manager. */
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @Permissions('listings:manage')
  @Delete('rent-payments/:paymentId')
  removePayment(@Param('paymentId', ParseUUIDPipe) paymentId: string) {
    return this.terms.removePayment(paymentId);
  }
}
