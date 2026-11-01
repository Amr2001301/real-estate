import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * A signing link for a booking. The document is laid out by the API from the
 * booking and the company's wording (the same one the dashboard prints), so
 * the dashboard and the staff app send the same form; its hash is what the
 * customer signs.
 */
export class CreateSignatureRequestDto {
  /** The language the form is written in (default Arabic). */
  @IsOptional()
  @IsIn(['ar', 'en'])
  locale?: 'ar' | 'en';
}

export class SignDocumentDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'الكود ٦ أرقام' })
  code!: string;

  /** The name the customer types under their signature. */
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  /** The drawn signature: a PNG data URL. */
  @IsString()
  @MaxLength(95_000)
  @Matches(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, { message: 'التوقيع غير صالح' })
  signature!: string;
}
