import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CreateCustomerFieldDto, UpdateCustomerFieldDto } from './dto/customer-field.dto';
import { CustomerFieldsService } from './customer-fields.service';

/**
 * The company's extra customer fields. The admin defines them (under the
 * company-branding permission, with the print settings); the staff who fill
 * a customer's data and print the forms read them.
 */
@ApiTags('customer-fields')
@Controller('customer-fields')
export class CustomerFieldsController {
  constructor(private readonly service: CustomerFieldsService) {}

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Get()
  list() {
    return this.service.list();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('company_branding:manage')
  @Post()
  create(@Body() dto: CreateCustomerFieldDto) {
    return this.service.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('company_branding:manage')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCustomerFieldDto) {
    return this.service.update(id, dto);
  }
}
