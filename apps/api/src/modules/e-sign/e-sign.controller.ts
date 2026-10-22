import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { CreateSignatureRequestDto, SignDocumentDto } from './dto/e-sign.dto';
import { ESignService } from './e-sign.service';

/** The visitor's address behind the hosting's proxy, as evidence of the signature. */
function clientIp(req: Request): string | null {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return first || req.ip || null;
}

/** Staff: send a booking for the customer's signature, follow it, cancel it. */
@ApiTags('e-sign')
@Controller()
export class ESignController {
  constructor(private readonly service: ESignService) {}

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Post('reservations/:id/signature-requests')
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSignatureRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createForReservation(id, dto, user);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Get('reservations/:id/signature-requests')
  list(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.listForReservation(id, user);
  }

  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES)
  @Delete('signature-requests/:id')
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.cancel(id, user);
  }

  // ── The customer, by the link (on the company's website) ──

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get('public/e-sign/:token')
  view(@Param('token') token: string) {
    return this.service.view(token);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('public/e-sign/:token/code')
  sendCode(@Param('token') token: string) {
    return this.service.sendCode(token);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('public/e-sign/:token/sign')
  sign(@Param('token') token: string, @Body() dto: SignDocumentDto, @Req() req: Request) {
    return this.service.sign(token, dto, {
      ip: clientIp(req),
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
    });
  }
}
