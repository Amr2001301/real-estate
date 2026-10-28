import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ENTITY_CODE_PATTERN, normalizeEntityCode } from '../../../common/utils/entity-code';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Records sent in one request, at most. */
export const MIGRATION_BATCH_MAX = 500;

// ── Platform owner ───────────────────────────────────────────────────────────

export class CreateMigrationRunDto {
  /** The other system's name as people say it: «إنجاز», "Salesforce". */
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(80)
  sourceLabel!: string;

  /** The other system as a slug; made from the name when left out. */
  @IsOptional()
  @Transform(trim)
  @Matches(/^[a-z0-9][a-z0-9-]{0,59}$/, { message: 'اسم النظام بالإنجليزي: حروف صغيرة وأرقام و - (حتى ٦٠)' })
  sourceSystem?: string;

  /** How long the key works, in days (7 when left out). */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(30)
  days?: number;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(300)
  note?: string;
}

/** MG2 — the platform owner's choice for one kept value or extra field. */
export class SaveMappingDto {
  @Transform(trim) @Matches(/^[a-z0-9][a-z0-9-]{0,59}$/)
  sourceSystem!: string;

  /** "LEAD.stage", "LEAD.source", … or an extra field: "CUSTOMER.extra.<key>". */
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(160)
  field!: string;

  /** The value as the other system wrote it (not for an extra field). */
  @IsOptional() @IsString() @MaxLength(200)
  value?: string;

  @IsIn(['MAP', 'IGNORE', 'NOTE', 'CUSTOMER_FIELD'])
  action!: string;

  /** What it maps to: a stage / kind / result, a source or person id, a unit type code, a customer field key. */
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120)
  target?: string;
}

// ── What the other system sends ──────────────────────────────────────────────
// Each list is checked item by item (one bad record never blocks the rest),
// so the body itself only carries the list.

export class MigrationBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MIGRATION_BATCH_MAX)
  // Kept as sent (no conversion); a non-object item is reported on its own.
  @Transform(({ obj }) => obj.items)
  items!: unknown[];
}

abstract class MigrationItem {
  /** The record's id in the other system: the same id sent again updates it. */
  @Transform(trim) @IsString() @Length(1, 120)
  externalId!: string;

  /** Anything this system has no field for, kept as sent. */
  @IsOptional() @IsObject()
  extra?: Record<string, unknown>;
}

export class MigrationProjectItem extends MigrationItem {
  @Transform(trim) @IsString() @Length(1, 200)
  name!: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(200)
  nameEn?: string;

  /** The project's code here; made from the external id when left out. */
  @IsOptional()
  @Transform(({ value }) => normalizeEntityCode(value))
  @Matches(ENTITY_CODE_PATTERN, { message: 'code: 2–64 English capital letters, digits or -' })
  code?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(100)
  city?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(5000)
  description?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(40)
  status?: string;
}

export class MigrationUnitItem extends MigrationItem {
  @Transform(trim) @IsString() @Length(1, 120)
  projectExternalId!: string;

  @Transform(trim) @IsString() @Length(1, 40)
  code!: string;

  /** The phase and building by name; the project's first ones when left out. */
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100)
  phase?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(100)
  building?: string;

  /** A unit type of the company, by its code or name. */
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60)
  type?: string;

  @IsOptional() @IsNumber() @Min(0) @Max(1_000_000)
  area?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(1_000_000_000_000)
  price?: number;

  @IsOptional() @IsInt() @Min(-10) @Max(300)
  floor?: number;

  @IsOptional() @IsInt() @Min(0) @Max(50)
  bedrooms?: number;

  @IsOptional() @IsInt() @Min(0) @Max(50)
  bathrooms?: number;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(40)
  status?: string;
}

export class MigrationCustomerItem extends MigrationItem {
  @Transform(trim) @IsString() @Length(1, 200)
  fullName!: string;

  @Transform(trim) @IsString() @Length(3, 30)
  phone!: string;

  @IsOptional() @Transform(trim) @IsEmail()
  email?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(/^[A-Za-z0-9]{5,20}$/, { message: 'nationalId: 5–20 letters or digits' })
  nationalId?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(300)
  address?: string;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'birthDate: YYYY-MM-DD' })
  birthDate?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(120)
  occupation?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(120)
  employer?: string;
}

export class MigrationLeadItem extends MigrationItem {
  @Transform(trim) @IsString() @Length(1, 200)
  fullName!: string;

  @Transform(trim) @IsString() @Length(3, 30)
  phone!: string;

  @IsOptional() @Transform(trim) @IsEmail()
  email?: string;

  /** Free text, matched to a stage here; kept for mapping when not recognised. */
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60)
  stage?: string;

  /** Free text, matched to one of the company's lead sources by name. */
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100)
  source?: string;

  /** The sales person's e-mail or phone. */
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200)
  assignedTo?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(120)
  projectExternalId?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(120)
  unitExternalId?: string;

  /** When the lead came in, in the other system. */
  @IsOptional() @IsISO8601()
  createdAt?: string;

  @IsOptional() @IsISO8601()
  nextActionAt?: string;

  /** A first note on the lead (on its first sending only). */
  @IsOptional() @Transform(trim) @IsString() @MaxLength(5000)
  note?: string;
}

export class MigrationActivityItem extends MigrationItem {
  @Transform(trim) @IsString() @Length(1, 120)
  leadExternalId!: string;

  @Transform(trim) @IsString() @Length(1, 5000)
  text!: string;

  /** Call, meeting, WhatsApp, follow-up or note — free text, matched here. */
  @IsOptional() @Transform(trim) @IsString() @MaxLength(40)
  kind?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(40)
  callResult?: string;

  @IsOptional() @IsISO8601()
  at?: string;

  /** Who did it: a staff member's e-mail or phone. */
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200)
  by?: string;
}
