import { ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export const LETTERHEAD_MODES = ['BUILT_IN', 'HEADER_FOOTER', 'FULL_PAGE'] as const;
export type LetterheadMode = (typeof LETTERHEAD_MODES)[number];

export const SEAL_DOCUMENTS = ['CONTRACT', 'RESERVATION', 'RECEIPT', 'STATEMENT'] as const;
export type SealDocument = (typeof SEAL_DOCUMENTS)[number];

export const TEMPLATE_DOCUMENTS = ['CONTRACT', 'RESERVATION'] as const;
export type TemplateDocument = (typeof TEMPLATE_DOCUMENTS)[number];

export const TEMPLATE_VARIANTS = ['ANY', 'CASH', 'INSTALLMENT'] as const;
export type TemplateVariant = (typeof TEMPLATE_VARIANTS)[number];

export const PRINT_ASSETS = ['signature', 'stamp'] as const;
export type PrintAsset = (typeof PRINT_ASSETS)[number];

const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

/** A letterhead image: our own uploads only (https), or null to clear it. */
const IMAGE_URL = { protocols: ['https', 'http'], require_protocol: true, require_tld: false };

export class PatchPrintSettingsDto {
  @IsOptional()
  @IsIn(LETTERHEAD_MODES)
  letterheadMode?: LetterheadMode;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_o, v) => v !== null)
  @IsUrl(IMAGE_URL)
  @MaxLength(1000)
  headerImageUrl?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_o, v) => v !== null)
  @IsUrl(IMAGE_URL)
  @MaxLength(1000)
  footerImageUrl?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_o, v) => v !== null)
  @IsUrl(IMAGE_URL)
  @MaxLength(1000)
  pageImageUrl?: string | null;

  // The space the text keeps from the page's edges (inside the paper's own
  // header and footer when the company prints on its letterhead).
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(80)
  marginTopMm?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(80)
  marginBottomMm?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(40)
  marginSideMm?: number;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(120)
  signatoryName?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(120)
  signatoryTitle?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(SEAL_DOCUMENTS, { each: true })
  sealDocuments?: SealDocument[];
}

export class CreateDocumentTemplateDto {
  @IsIn(TEMPLATE_DOCUMENTS)
  documentType!: TemplateDocument;

  @IsOptional()
  @IsIn(TEMPLATE_VARIANTS)
  variant?: TemplateVariant;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(60_000)
  body!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateDocumentTemplateDto {
  @IsOptional()
  @IsIn(TEMPLATE_VARIANTS)
  variant?: TemplateVariant;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60_000)
  body?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class TemplatesQueryDto {
  @IsOptional()
  @IsIn(TEMPLATE_DOCUMENTS)
  documentType?: TemplateDocument;
}
