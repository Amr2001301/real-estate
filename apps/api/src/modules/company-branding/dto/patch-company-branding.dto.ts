import {
  IsOptional,
  IsString,
  IsEmail,
  Matches,
  MaxLength,
  ValidateNested,
  IsObject,
  registerDecorator,
  type ValidationOptions,
  type ValidationArguments,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Contrast helper ─────────────────────────────────────────────────────────

function hexRelativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const linearize = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const r = linearize(parseInt(h.slice(0, 2), 16) / 255);
  const g = linearize(parseInt(h.slice(2, 4), 16) / 255);
  const b = linearize(parseInt(h.slice(4, 6), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of a hex colour against pure white (1:1). */
export function contrastAgainstWhite(hex: string): number {
  const L = hexRelativeLuminance(hex);
  return 1.05 / (L + 0.05);
}

/** Custom validator: primary colour must contrast ≥ 3:1 against white. */
function IsContrastSafe(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isContrastSafe',
      target: object.constructor,
      propertyName,
      options: {
        message:
          'primaryColor does not have sufficient contrast against white (minimum 3:1 required). Choose a darker colour.',
        ...options,
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return true; // let other validators handle type
          if (!/^#[0-9a-fA-F]{6}$/.test(value.trim())) return true; // let hex validator fire first
          return contrastAgainstWhite(value.trim()) >= 3.0;
        },
        defaultMessage(_args: ValidationArguments) {
          return 'primaryColor does not have sufficient contrast against white (minimum 3:1 required). Choose a darker colour.';
        },
      },
    });
  };
}

// ── Sub-DTOs ────────────────────────────────────────────────────────────────

export class TranslatableDto {
  @IsOptional() @IsString() @MaxLength(200) ar?: string;
  @IsOptional() @IsString() @MaxLength(200) en?: string;
}

export class SocialLinksDto {
  @IsOptional() @IsString() @MaxLength(500) instagram?: string;
  @IsOptional() @IsString() @MaxLength(500) facebook?: string;
  @IsOptional() @IsString() @MaxLength(500) twitter?: string;
  @IsOptional() @IsString() @MaxLength(500) linkedin?: string;
  @IsOptional() @IsString() @MaxLength(500) youtube?: string;
  @IsOptional() @IsString() @MaxLength(500) tiktok?: string;
}

// ── Main DTO ────────────────────────────────────────────────────────────────

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export class PatchCompanyBrandingDto {
  // Identity
  @IsOptional() @IsString() @MaxLength(120) displayName?: string;
  @IsOptional() @ValidateNested() @Type(() => TranslatableDto) tagline?: TranslatableDto;
  @IsOptional() @IsString() @MaxLength(2048) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(2048) faviconUrl?: string;
  @IsOptional() @IsString() @MaxLength(2048) ogImageUrl?: string;

  // Colours — strict 6-digit hex (#RRGGBB) only.
  //
  // primaryColor: must contrast ≥ 3:1 against white (WCAG AA for UI surfaces).
  // accentColor:  format-only — accent is used as a highlight/glow, not as a text
  //               background, so the 3:1 background-contrast gate is intentionally
  //               not applied. Light golds (#C8A24B, ≈ 2.3:1) are valid accents.
  @IsOptional() @Matches(HEX_COLOR, { message: 'primaryColor must be a 6-digit hex colour, e.g. #1E3A5F' })
  @IsContrastSafe()
  primaryColor?: string;

  @IsOptional() @Matches(HEX_COLOR, { message: 'accentColor must be a 6-digit hex colour, e.g. #C8A24B' })
  accentColor?: string;

  // Contact
  @IsOptional() @IsEmail() @MaxLength(200) contactEmail?: string;
  @IsOptional() @IsString() @MaxLength(30)  contactPhone?: string;
  @IsOptional() @IsString() @MaxLength(30)  contactWhatsApp?: string;
  @IsOptional() @ValidateNested() @Type(() => TranslatableDto) contactAddress?: TranslatableDto;
  @IsOptional() @ValidateNested() @Type(() => TranslatableDto) officeHours?: TranslatableDto;

  // Social + legal
  @IsOptional() @IsObject() @ValidateNested() @Type(() => SocialLinksDto) socialLinks?: SocialLinksDto;
  @IsOptional() @IsString() @MaxLength(80) registrationNumber?: string;
}
