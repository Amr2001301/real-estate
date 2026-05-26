import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ChatSource, ChatFeedbackRating, Locale } from '@prisma/client';

export class CreateSessionDto {
  @IsOptional() @IsEnum(ChatSource) source?: ChatSource;
  @IsOptional() @IsEnum(Locale) locale?: Locale;
  @IsString() @MinLength(1) @MaxLength(200) anonymousId!: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class SendMessageDto {
  @IsString() @MinLength(1) @MaxLength(200) anonymousId!: string;
  @IsString() @MinLength(1) @MaxLength(2000) content!: string;
}

export class GetSessionQueryDto {
  @IsString() @MinLength(1) @MaxLength(200) anonymousId!: string;
}

export class FeedbackDto {
  @IsString() @MinLength(1) @MaxLength(200) anonymousId!: string;
  @IsOptional() @IsUUID() messageId?: string;
  @IsEnum(ChatFeedbackRating) rating!: ChatFeedbackRating;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}
