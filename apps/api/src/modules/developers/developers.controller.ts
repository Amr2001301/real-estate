import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { DevelopersService } from './developers.service';
import {
  ComparePlansDto,
  CreateDeveloperDto,
  CreatePlanDto,
  CreateProjectDto,
  UpdateDeveloperDto,
  UpdatePlanDto,
  UpdateProjectDto,
} from './dto/developer.dto';

const ALL = [UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES] as const;
const EDITORS = [UserRole.ADMIN, UserRole.SALES_MANAGER] as const;

/**
 * BRK-5 — the brokerage's developer directory (brokerage companies only).
 * Every sales role reads it and compares plans; the admin and sales
 * managers keep it.
 */
@ApiTags('developers')
@Controller('developers')
export class DevelopersController {
  constructor(private readonly developers: DevelopersService) {}

  @Roles(...ALL)
  @Permissions('listings:read')
  @Get()
  list(@Query('q') q?: string) {
    return this.developers.list(q);
  }

  @Roles(...ALL)
  @Permissions('listings:read')
  @Get('projects/options')
  projectOptions() {
    return this.developers.projectOptions();
  }

  @Roles(...ALL)
  @Permissions('listings:read')
  @Get('plans/options')
  planOptions() {
    return this.developers.planOptions();
  }

  @Roles(...ALL)
  @Permissions('listings:read')
  @Post('plans/compare')
  compare(@Body() dto: ComparePlansDto) {
    return this.developers.compare(dto);
  }

  @Roles(...EDITORS)
  @Permissions('listings:manage')
  @Post()
  create(@Body() dto: CreateDeveloperDto) {
    return this.developers.create(dto);
  }

  @Roles(...EDITORS)
  @Permissions('listings:manage')
  @Patch('projects/:id')
  updateProject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProjectDto) {
    return this.developers.updateProject(id, dto);
  }

  @Roles(...EDITORS)
  @Permissions('listings:manage')
  @Delete('projects/:id')
  removeProject(@Param('id', ParseUUIDPipe) id: string) {
    return this.developers.removeProject(id);
  }

  @Roles(...EDITORS)
  @Permissions('listings:manage')
  @Post('projects/:id/plans')
  createPlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreatePlanDto) {
    return this.developers.createPlan(id, dto);
  }

  @Roles(...EDITORS)
  @Permissions('listings:manage')
  @Patch('plans/:id')
  updatePlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto) {
    return this.developers.updatePlan(id, dto);
  }

  @Roles(...EDITORS)
  @Permissions('listings:manage')
  @Delete('plans/:id')
  removePlan(@Param('id', ParseUUIDPipe) id: string) {
    return this.developers.removePlan(id);
  }

  @Roles(...ALL)
  @Permissions('listings:read')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.developers.get(id);
  }

  @Roles(...EDITORS)
  @Permissions('listings:manage')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDeveloperDto) {
    return this.developers.update(id, dto);
  }

  @Roles(...EDITORS)
  @Permissions('listings:manage')
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.developers.remove(id);
  }

  @Roles(...EDITORS)
  @Permissions('listings:manage')
  @Post(':id/projects')
  createProject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateProjectDto) {
    return this.developers.createProject(id, dto);
  }
}
