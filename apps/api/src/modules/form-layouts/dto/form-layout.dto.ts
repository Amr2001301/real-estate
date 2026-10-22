import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const FORM_DOCUMENTS = ['RESERVATION', 'RECEIPT', 'CONTRACT'] as const;
export type FormDocument = (typeof FORM_DOCUMENTS)[number];

/** A4, A5, or half an A4 sheet (landscape, 210 × 148.5 mm). */
export const PAPER_SIZES = ['A4', 'A5', 'HALF'] as const;
export type PaperSize = (typeof PAPER_SIZES)[number];

/** A form's pages at most: a contract runs to many. */
export const MAX_FORM_PAGES = 40;

/** The sizes each document prints on: a booking form and a contract are A4. */
export const DOCUMENT_PAPER: Record<FormDocument, readonly PaperSize[]> = {
  RESERVATION: ['A4'],
  CONTRACT: ['A4'],
  RECEIPT: PAPER_SIZES,
};

export class FormPageDto {
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true, require_tld: false })
  @MaxLength(1000)
  imageUrl!: string;
}

/**
 * A value placed on the form: a placeholder key ("customer.name",
 * "custom.marital"), or a signature box ("sign.customer", "sign.company",
 * "sign.stamp"). Its box is in
 * fractions of the page (0–1); its text size in points.
 */
export class FormFieldDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,40}$/)
  id!: string;

  @IsString()
  @Matches(/^[a-zA-Z][a-zA-Z0-9_.]{1,59}$/)
  key!: string;

  @IsInt()
  @Min(0)
  @Max(MAX_FORM_PAGES - 1)
  page!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  x!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  y!: number;

  @IsNumber()
  @Min(0.005)
  @Max(1)
  w!: number;

  @IsNumber()
  @Min(0.005)
  @Max(1)
  h!: number;

  @IsNumber()
  @Min(6)
  @Max(36)
  size!: number;

  @IsIn(['start', 'center', 'end'])
  align!: 'start' | 'center' | 'end';

  @IsOptional()
  @IsBoolean()
  bold?: boolean;
}

export class SaveFormLayoutDto {
  @IsIn(FORM_DOCUMENTS)
  documentType!: FormDocument;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsIn(PAPER_SIZES)
  paperSize?: PaperSize;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_FORM_PAGES)
  @ValidateNested({ each: true })
  @Type(() => FormPageDto)
  pages!: FormPageDto[];

  @IsArray()
  @ArrayMaxSize(400)
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields!: FormFieldDto[];

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class FormLayoutsQueryDto {
  @IsOptional()
  @IsIn(FORM_DOCUMENTS)
  documentType?: FormDocument;
}
