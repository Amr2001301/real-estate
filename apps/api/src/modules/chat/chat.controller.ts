import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { ChatService } from './chat.service';
import {
  CloseSessionDto,
  CreateSessionDto,
  FeedbackDto,
  GetSessionQueryDto,
  SendMessageDto,
} from './dto/chat.dto';

/**
 * Public AI Chat API (v1). No auth — identity is a client-generated
 * `anonymousId` that must match the session for any read/write. Mobile reuses
 * these exact endpoints (source=MOBILE). All routes throttled.
 */
@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('sessions')
  createSession(@Body() dto: CreateSessionDto) {
    return this.chat.createSession(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('sessions/:id/messages')
  sendMessage(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SendMessageDto) {
    return this.chat.sendMessage(id, dto);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get('sessions/:id')
  getSession(@Param('id', ParseUUIDPipe) id: string, @Query() query: GetSessionQueryDto) {
    return this.chat.getSession(id, query.anonymousId);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('sessions/:id/feedback')
  feedback(@Param('id', ParseUUIDPipe) id: string, @Body() dto: FeedbackDto) {
    return this.chat.addFeedback(id, dto);
  }

  /** Mark a session CLOSED (user started a new chat). Messages are kept. */
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Patch('sessions/:id/close')
  close(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseSessionDto) {
    return this.chat.closeSession(id, dto.anonymousId);
  }
}
