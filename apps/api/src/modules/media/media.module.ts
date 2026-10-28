import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Injectable,
  NotFoundException,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { MediaType, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { GrantedBy } from '../../common/decorators/granted-by.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { R2Service } from './r2.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';

// 50 MiB — sized to accommodate compressed property marketing videos (video/mp4).
// Images are typically under 5 MiB; the extra headroom is for video uploads.
export const MAX_MEDIA_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;

// Explicit allowlist of MIME types the general media presign endpoint accepts.
// SVG is excluded: it is a document format, not an image. An SVG served from a
// same-origin or same-site CDN with Content-Type: image/svg+xml executes scripts
// on direct navigation, bypassing the <img> sandbox. PNG/WebP cover every real
// logo use case. Sanitising SVG properly (external refs, xlink, stylesheets) has
// no maintained JS library; the maintenance burden exceeds the benefit.
// Dangerous types (text/html, application/javascript, etc.) are never added here.
export const ALLOWED_MEDIA_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'application/pdf', // receipts (deposit payment proof) and floor-plan attachments
] as const;

export type AllowedMediaMimeType = (typeof ALLOWED_MEDIA_MIME_TYPES)[number];

// Per-asset limits for the branding folder. Enforced in MediaService.presign()
// whenever folder==='branding' and brandingAsset is provided.
//
// SVG is excluded from all asset types — see ALLOWED_MEDIA_MIME_TYPES comment.
// logo    — raster only; max 512 KB
// favicon — raster only; max 128 KB
// og      — raster only (Open Graph crawlers don't render SVG); max 1 MB
// letterhead — the company's printed paper (header, footer or whole page); max 2 MB
const BRANDING_ASSET_POLICY = {
  logo:    { maxBytes: 512 * 1024,       allowedMimes: new Set(['image/jpeg', 'image/png', 'image/webp']) },
  favicon: { maxBytes: 128 * 1024,       allowedMimes: new Set(['image/jpeg', 'image/png', 'image/webp']) },
  og:      { maxBytes: 1 * 1024 * 1024,  allowedMimes: new Set(['image/jpeg', 'image/png', 'image/webp']) },
  letterhead: { maxBytes: 2 * 1024 * 1024, allowedMimes: new Set(['image/jpeg', 'image/png', 'image/webp']) },
} as const;

type BrandingAsset = keyof typeof BRANDING_ASSET_POLICY;

class CreatePresignedDto {
  @IsIn([...ALLOWED_MEDIA_MIME_TYPES])
  contentType!: AllowedMediaMimeType;

  @IsIn(['projects', 'units', 'banners', 'receipts', 'branding'])
  folder!: 'projects' | 'units' | 'banners' | 'receipts' | 'branding';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_MEDIA_UPLOAD_SIZE_BYTES)
  sizeBytes!: number;

  @IsOptional()
  @IsString()
  extension?: string;

  // Required when folder==='branding'; ignored otherwise.
  // Drives per-asset MIME allowlist and size cap (see BRANDING_ASSET_POLICY).
  @ValidateIf((o: CreatePresignedDto) => o.folder === 'branding')
  @IsIn(['logo', 'favicon', 'og', 'letterhead'])
  brandingAsset?: BrandingAsset;
}

class AttachProjectMediaDto {
  @IsUUID() projectId!: string;
  @IsString() url!: string;
  @IsOptional() @IsEnum(MediaType) type?: MediaType;
  @IsOptional() @IsInt() @Min(0) order?: number;
}

class AttachUnitMediaDto {
  @IsUUID() unitId!: string;
  @IsString() url!: string;
  @IsOptional() @IsEnum(MediaType) type?: MediaType;
  @IsOptional() @IsInt() @Min(0) order?: number;
}

@Injectable()
class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  presign(dto: CreatePresignedDto) {
    // Defense-in-depth: enforce policy even if DTO validation is bypassed internally.
    if (!(ALLOWED_MEDIA_MIME_TYPES as readonly string[]).includes(dto.contentType)) {
      throw new BadRequestException(`Content type "${dto.contentType}" is not allowed`);
    }
    if (!Number.isInteger(dto.sizeBytes) || dto.sizeBytes < 1 || dto.sizeBytes > MAX_MEDIA_UPLOAD_SIZE_BYTES) {
      throw new BadRequestException(`File size is invalid or exceeds the ${MAX_MEDIA_UPLOAD_SIZE_BYTES}-byte limit`);
    }

    // Per-asset branding limits — applied when caller identifies which asset they
    // are uploading.  When brandingAsset is omitted the flat 50 MiB cap above still
    // applies; the UI always sends brandingAsset so this path covers direct API use.
    if (dto.folder === 'branding' && dto.brandingAsset) {
      const policy = BRANDING_ASSET_POLICY[dto.brandingAsset];
      if (!policy.allowedMimes.has(dto.contentType as string)) {
        throw new BadRequestException(
          `"${dto.contentType}" is not allowed for branding ${dto.brandingAsset}. ` +
          `Accepted: ${[...policy.allowedMimes].join(', ')}`,
        );
      }
      if (dto.sizeBytes > policy.maxBytes) {
        throw new BadRequestException(
          `branding ${dto.brandingAsset} exceeds the ${policy.maxBytes}-byte limit`,
        );
      }
    }

    return this.r2.createPresignedUpload({
      contentType: dto.contentType,
      folder: dto.folder,
      extension: dto.extension,
      sizeBytes: dto.sizeBytes,
    });
  }

  async attachProject(dto: AttachProjectMediaDto) {
    // The id comes from the client: only this company's project takes media.
    const project = await this.prisma.project.findFirst({ where: { id: dto.projectId }, select: { id: true } });
    if (!project) throw new NotFoundException('Project not found');
    return this.prisma.projectMedia.create({
      data: {
        projectId: dto.projectId,
        url: dto.url,
        type: dto.type ?? MediaType.IMAGE,
        order: dto.order ?? 0,
      },
    });
  }

  async attachUnit(dto: AttachUnitMediaDto) {
    const unit = await this.prisma.unit.findFirst({ where: { id: dto.unitId }, select: { id: true } });
    if (!unit) throw new NotFoundException('Unit not found');
    return this.prisma.unitMedia.create({
      data: {
        unitId: dto.unitId,
        url: dto.url,
        type: dto.type ?? MediaType.IMAGE,
        order: dto.order ?? 0,
      },
    });
  }

  // Media rows carry no companyId of their own (tenant via their parent), so
  // the middleware does not scope these deletes: match the parent's company.
  async removeProjectMedia(id: string) {
    const { count } = await this.prisma.projectMedia.deleteMany({
      where: { id, project: { companyId: getRequiredCompanyId() } },
    });
    if (count === 0) throw new NotFoundException('Media not found');
    return { id };
  }

  async removeUnitMedia(id: string) {
    const { count } = await this.prisma.unitMedia.deleteMany({
      where: { id, unit: { companyId: getRequiredCompanyId() } },
    });
    if (count === 0) throw new NotFoundException('Media not found');
    return { id };
  }
}

@ApiTags('media')
@Controller('media')
class MediaController {
  constructor(private readonly media: MediaService) {}

  @Roles(UserRole.ADMIN)
  @Permissions('project_media:manage')
  @GrantedBy('project_media:manage')
  @Post('presign')
  presign(@Body() dto: CreatePresignedDto) {
    return this.media.presign(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('project_media:manage')
  @GrantedBy('project_media:manage')
  @Post('projects')
  attachProject(@Body() dto: AttachProjectMediaDto) {
    return this.media.attachProject(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('project_media:manage')
  @GrantedBy('project_media:manage')
  @Post('units')
  attachUnit(@Body() dto: AttachUnitMediaDto) {
    return this.media.attachUnit(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('project_media:manage')
  @GrantedBy('project_media:manage')
  @Delete('projects/:id')
  removeProject(@Param('id', ParseUUIDPipe) id: string) {
    return this.media.removeProjectMedia(id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('project_media:manage')
  @GrantedBy('project_media:manage')
  @Delete('units/:id')
  removeUnit(@Param('id', ParseUUIDPipe) id: string) {
    return this.media.removeUnitMedia(id);
  }
}

@Module({
  controllers: [MediaController],
  providers: [MediaService, R2Service],
  exports: [R2Service],
})
export class MediaModule {}
