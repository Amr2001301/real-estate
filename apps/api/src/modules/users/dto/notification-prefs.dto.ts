import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';

class NotificationGroupFlagsDto {
  @IsOptional() @IsBoolean() sales?: boolean;
  @IsOptional() @IsBoolean() finance?: boolean;
  @IsOptional() @IsBoolean() maintenance?: boolean;
  @IsOptional() @IsBoolean() account?: boolean;
}

/** The caller's e-mail / push opt-outs: only the groups sent change. */
export class NotificationPrefsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationGroupFlagsDto)
  email?: NotificationGroupFlagsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationGroupFlagsDto)
  push?: NotificationGroupFlagsDto;
}
