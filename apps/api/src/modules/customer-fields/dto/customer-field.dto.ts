import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const CUSTOMER_FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'SELECT'] as const;
export type CustomerFieldType = (typeof CUSTOMER_FIELD_TYPES)[number];

/** A key is what a document's wording names: {{custom.<key>}}. */
export const CUSTOMER_FIELD_KEY = /^[a-z][a-z0-9_]{0,39}$/;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimEach = ({ value }: { value: unknown }) =>
  Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v.trim() : v)) : value;

export class CreateCustomerFieldDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100) ar!: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100) en!: string;

  @IsIn(CUSTOMER_FIELD_TYPES)
  type!: CustomerFieldType;

  /** Fixed once created; defaults to one made from the English label. */
  @IsOptional()
  @Transform(trim)
  @Matches(CUSTOMER_FIELD_KEY, { message: 'المفتاح حروف إنجليزية صغيرة وأرقام و _ ويبدأ بحرف (حتى ٤٠)' })
  key?: string;

  /** The choices of a SELECT field. */
  @IsOptional()
  @Transform(trimEach)
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(100, { each: true })
  options?: string[];
}

/** The key and the type stay as created: stored values and wordings refer to them. */
export class UpdateCustomerFieldDto {
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100) ar?: string;
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100) en?: string;

  @IsOptional()
  @Transform(trimEach)
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(100, { each: true })
  options?: string[];

  @IsOptional() @IsBoolean() active?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(1000) order?: number;
}
