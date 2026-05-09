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
import { LeadStage, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { LeadsService } from './leads.service';
import {
  AssignLeadDto,
  CreateLeadDto,
  CreateLeadNoteDto,
  CreateLeadSourceDto,
  UpdateLeadDto,
  UpdateLeadStageDto,
} from './dto/lead.dto';

@ApiTags('leads')
@Controller()
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  // Sources
  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get('lead-sources')
  listSources() {
    return this.leads.listSources();
  }

  @Roles(UserRole.ADMIN)
  @Post('lead-sources')
  createSource(@Body() dto: CreateLeadSourceDto) {
    return this.leads.createSource(dto);
  }

  // Pipeline counts
  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get('leads/pipeline')
  pipeline() {
    return this.leads.pipelineCounts();
  }

  // Leads
  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get('leads')
  list(
    @CurrentUser() user: AuthUser,
    @Query('stage') stage?: LeadStage,
    @Query('salesId') salesId?: string,
    @Query('q') q?: string,
    @Query('mine') mine?: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    const assignedToMe = mine === '1' && user.role === UserRole.SALES ? user.sub : undefined;
    const effectiveSalesId = user.role === UserRole.SALES ? user.sub : salesId;
    return this.leads.findAll({
      page: Number(page),
      pageSize: Number(pageSize),
      stage,
      salesId: effectiveSalesId,
      q,
      assignedToMe,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get('leads/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.leads.findOne(id);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Post('leads')
  create(@Body() dto: CreateLeadDto) {
    return this.leads.create(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Patch('leads/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadDto) {
    return this.leads.update(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Patch('leads/:id/stage')
  updateStage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadStageDto,
  ) {
    return this.leads.updateStage(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch('leads/:id/assign')
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignLeadDto) {
    return this.leads.assign(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Post('leads/:id/notes')
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLeadNoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leads.addNote(id, user.sub, dto);
  }
}
