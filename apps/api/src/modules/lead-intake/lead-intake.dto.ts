import { IsBoolean, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

/** A new lead posted by a lead source (Zapier / Make, a form tool…). */
export class IntakeLeadDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @IsNotEmpty() @MaxLength(32) phone!: string;
  @IsOptional() @IsEmail() email?: string;
  /** One of the company's projects; else the key's or the campaign's. */
  @IsOptional() @IsUUID() projectId?: string;
  /** A campaign's code (utm_campaign); else the key's campaign. */
  @IsOptional() @IsString() @MaxLength(60) campaign?: string;
  /** What the customer wrote in the form. */
  @IsOptional() @IsString() @MaxLength(2000) message?: string;
  @IsOptional() @IsString() @MaxLength(100) utmSource?: string;
  @IsOptional() @IsString() @MaxLength(100) utmMedium?: string;
  @IsOptional() @IsString() @MaxLength(200) utmContent?: string;
}

export class CreateIntakeKeyDto {
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsOptional() @IsUUID() campaignId?: string;
  @IsOptional() @IsUUID() projectId?: string;
}

export class UpdateIntakeKeyDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) name?: string;
  @ValidateIf((_o, v) => v !== null) @IsOptional() @IsUUID() campaignId?: string | null;
  @ValidateIf((_o, v) => v !== null) @IsOptional() @IsUUID() projectId?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class RoutingSettingsDto {
  @IsOptional() @IsIn(['ROUND_ROBIN', 'NONE']) autoAssign?: 'ROUND_ROBIN' | 'NONE';
  /** 0 schedules no first call. */
  @IsOptional() @IsInt() @Min(0) @Max(7 * 24 * 60) firstCallMinutes?: number;
}
