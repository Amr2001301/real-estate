import { Body, Controller, Delete, Get, Header, Headers, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Redirect, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { GrantedBy } from '../../common/decorators/granted-by.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PlatformPublic } from '../../common/decorators/platform-public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MetaRoutingDto } from './meta-leads.dto';
import { MetaLeadsService, type MetaWebhookBody } from './meta-leads.service';

/** Facebook and Instagram lead ads linked straight to a company's Facebook Page. */
@ApiTags('meta-leads')
@Controller('meta')
export class MetaLeadsController {
  constructor(private readonly meta: MetaLeadsService) {}

  // ── Admin ──
  @Roles(UserRole.ADMIN)
  @Permissions('campaigns:manage')
  @GrantedBy('campaigns:manage')
  @Get('status')
  status() {
    return this.meta.status();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('campaigns:manage')
  @GrantedBy('campaigns:manage')
  @Post('connect')
  connect(@CurrentUser() user: AuthUser) {
    return this.meta.connectUrl(user.sub);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('campaigns:manage')
  @GrantedBy('campaigns:manage')
  @Post('connections/:id/activate')
  activate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MetaRoutingDto) {
    return this.meta.activate(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('campaigns:manage')
  @GrantedBy('campaigns:manage')
  @Patch('connections/:id')
  route(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MetaRoutingDto) {
    return this.meta.route(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('campaigns:manage')
  @GrantedBy('campaigns:manage')
  @Delete('connections/:id')
  disconnect(@Param('id', ParseUUIDPipe) id: string) {
    return this.meta.disconnect(id);
  }

  // ── Facebook ──
  /** Where Facebook sends the admin after the login dialog; the signed `state` says who started it. */
  @PlatformPublic()
  @SkipThrottle()
  @Get('callback')
  @Redirect()
  async callback(@Query('code') code?: string, @Query('state') state?: string, @Query('error') error?: string) {
    return { url: await this.meta.callback({ code, state, error }), statusCode: 302 };
  }

  /** Facebook's "is this address yours?" check. */
  @PlatformPublic()
  @SkipThrottle()
  @Get('webhook')
  @Header('Content-Type', 'text/plain')
  verify(@Query('hub.mode') mode?: string, @Query('hub.verify_token') token?: string, @Query('hub.challenge') challenge?: string) {
    return this.meta.verifyChallenge(mode, token, challenge);
  }

  @PlatformPublic()
  @SkipThrottle()
  @HttpCode(200)
  @Post('webhook')
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-hub-signature-256') signature: string | undefined, @Body() body: MetaWebhookBody) {
    return this.meta.receive(req.rawBody, signature, body);
  }
}
