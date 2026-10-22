import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { FormLayoutsQueryDto, SaveFormLayoutDto } from './dto/form-layout.dto';
import { FormLayoutsService } from './form-layouts.service';

/** The company's own paper forms: the admin designs them, the staff print with them. */
@ApiTags('print-settings')
@Controller('form-layouts')
export class FormLayoutsController {
  constructor(private readonly service: FormLayoutsService) {}

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Get()
  list(@Query() q: FormLayoutsQueryDto) {
    return this.service.list(q.documentType);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('company_branding:manage')
  @Post()
  create(@Body() dto: SaveFormLayoutDto) {
    return this.service.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('company_branding:manage')
  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveFormLayoutDto) {
    return this.service.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('company_branding:manage')
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
