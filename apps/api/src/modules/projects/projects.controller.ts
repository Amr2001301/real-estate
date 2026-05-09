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
import { ProjectsService } from './projects.service';
import { CreateProjectDto, ProjectQueryDto, UpdateProjectDto } from './dto/project.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('projects')
@Controller()
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  // ----- Public (guest browsing) -----
  @Public()
  @Get('public/projects')
  publicList(@Query() query: ProjectQueryDto) {
    return this.projects.findAll(query, true);
  }

  @Public()
  @Get('public/projects/:id')
  publicGet(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.findOne(id, true);
  }

  // ----- Admin/Sales -----
  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get('projects')
  list(@Query() query: ProjectQueryDto) {
    return this.projects.findAll(query, false);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get('projects/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Post('projects')
  create(@Body() dto: CreateProjectDto) {
    return this.projects.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch('projects/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete('projects/:id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.remove(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch('projects/:id/publish')
  publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.publish(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch('projects/:id/archive')
  archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.archive(id);
  }
}
