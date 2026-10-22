import { IsObject, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * The document as the customer will read it, laid out by the dashboard from
 * the record and the company's wording. Kept as sent; its hash is what the
 * customer signs.
 */
export class CreateSignatureRequestDto {
  @IsObject()
  snapshot!: Record<string, unknown>;
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
