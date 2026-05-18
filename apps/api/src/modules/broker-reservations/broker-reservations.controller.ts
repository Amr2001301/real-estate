import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { BrokerReservationsService } from './broker-reservations.service';
import {
  BrokerReservationsQueryDto,
  CreateAdminBrokerReservationDto,
} from './dto/broker-reservation.dto';

@ApiTags('broker-reservations')
@Controller('broker-reservations')
export class BrokerReservationsController {
  constructor(private readonly svc: BrokerReservationsService) {}

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get()
  list(
    @Query() query: BrokerReservationsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.list(query, user);
  }

  // Admin-only: create a broker-originated reservation on behalf of a broker.
  // Mounted BEFORE the `:id` GET below so the literal POST never collides.
  @Roles(UserRole.ADMIN)
  @Post()
  createOnBehalfOfBroker(
    @Body() dto: CreateAdminBrokerReservationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.createOnBehalfOfBroker(user, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES)
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.findOne(id, user);
  }
}
