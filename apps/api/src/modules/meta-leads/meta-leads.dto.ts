import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

/** Where a linked Page's leads are filed. */
export class MetaRoutingDto {
  @ValidateIf((_o, v) => v !== null)
  @IsOptional()
  @IsUUID()
  campaignId?: string | null;

  @ValidateIf((_o, v) => v !== null)
  @IsOptional()
  @IsUUID()
  projectId?: string | null;
}
