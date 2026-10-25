import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUrl, Length, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export const MOBILE_APP_STATUSES = ['DRAFT', 'IN_REVIEW', 'PUBLISHED'] as const;
export type MobileAppStatus = (typeof MOBILE_APP_STATUSES)[number];

/** Android applicationId / iOS bundle id: two or more lower-case segments. */
export const PACKAGE_ID_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

// Local dev storage (MinIO) serves over http without a TLD.
const ASSET_URL = { protocols: ['https', 'http'], require_protocol: true, require_tld: false };
const STORE_URL = { protocols: ['https'], require_protocol: true };

export class PutCompanyMobileAppDto {
  /** The name under the icon on the phone — stores show it as the app's title. */
  @IsString() @Length(2, 30) appNameAr!: string;
  @IsString() @Length(2, 30) appNameEn!: string;

  @IsString()
  @MaxLength(150)
  @Matches(PACKAGE_ID_PATTERN, { message: 'packageId must look like com.company.app (lower-case letters, digits, _)' })
  packageId!: string;

  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsUrl(ASSET_URL) @MaxLength(2048) iconUrl?: string | null;
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsUrl(ASSET_URL) @MaxLength(2048) splashUrl?: string | null;

  @IsOptional() @IsIn(MOBILE_APP_STATUSES) status?: MobileAppStatus;

  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsUrl(STORE_URL) @MaxLength(2048) playStoreUrl?: string | null;
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsUrl(STORE_URL) @MaxLength(2048) appStoreUrl?: string | null;
}

export const MOBILE_APP_ASSETS = ['icon', 'splash'] as const;
export type MobileAppAsset = (typeof MOBILE_APP_ASSETS)[number];

export class PresignMobileAppAssetDto {
  @IsIn(MOBILE_APP_ASSETS) asset!: MobileAppAsset;
  /** Store icons and splash images are PNG. */
  @IsIn(['image/png']) contentType!: 'image/png';
  @Type(() => Number) @IsInt() @Min(1) @Max(2 * 1024 * 1024) sizeBytes!: number;
  /** Sent by the dashboard's shared uploader; the files always go to branding/ as .png. */
  @IsOptional() @IsIn(['branding']) folder?: 'branding';
  @IsOptional() @IsString() @MaxLength(10) extension?: string;
}
