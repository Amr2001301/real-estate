import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MediaType, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { R2Service } from './r2.service';

// 50 MiB — sized to accommodate compressed property marketing videos (video/mp4).
// Images are typically under 5 MiB; the extra headroom is for video uploads.
export const MAX_MEDIA_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;

// Explicit allowlist of MIME types the general media presign endpoint accepts.
// SVG is excluded (can contain active/scriptable content).
// Dangerous types (text/html, application/javascript, etc.) are never added here.
export const ALLOWED_MEDIA_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'application/pdf', // receipts (deposit payment proof) and floor-plan attachments
] as const;

export type AllowedMediaMimeType = (typeof ALLOWED_MEDIA_MIME_TYPES)[number];

class CreatePresignedDto {
  @IsIn([...ALLOWED_MEDIA_MIME_TYPES])
  contentType!: AllowedMediaMimeType;

  @IsIn(['projects', 'units', 'banners', 'receipts'])
  folder!: 'projects' | 'units' | 'banners' | 'receipts';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_MEDIA_UPLOAD_SIZE_BYTES)
  sizeBytes!: number;

  @IsOptional()
  @IsString()
  extension?: string;
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
    return this.r2.createPresignedUpload({
      contentType: dto.contentType,
      folder: dto.folder,
      extension: dto.extension,
    });
  }

  attachProject(dto: AttachProjectMediaDto) {
    return this.prisma.projectMedia.create({
      data: {
        projectId: dto.projectId,
        url: dto.url,
        type: dto.type ?? MediaType.IMAGE,
        order: dto.order ?? 0,
      },
    });
  }

  attachUnit(dto: AttachUnitMediaDto) {
    return this.prisma.unitMedia.create({
      data: {
        unitId: dto.unitId,
        url: dto.url,
        type: dto.type ?? MediaType.IMAGE,
        order: dto.order ?? 0,
      },
    });
  }

  removeProjectMedia(id: string) {
    return this.prisma.projectMedia.delete({ where: { id } });
  }

  removeUnitMedia(id: string) {
    return this.prisma.unitMedia.delete({ where: { id } });
  }
}

@ApiTags('media')
@Controller('media')
class MediaController {
  constructor(private readonly media: MediaService) {}

  @Roles(UserRole.ADMIN)
  @Permissions('project_media:manage')
  @Post('presign')
  presign(@Body() dto: CreatePresignedDto) {
    return this.media.presign(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('project_media:manage')
  @Post('projects')
  attachProject(@Body() dto: AttachProjectMediaDto) {
    return this.media.attachProject(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('project_media:manage')
  @Post('units')
  attachUnit(@Body() dto: AttachUnitMediaDto) {
    return this.media.attachUnit(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('project_media:manage')
  @Delete('projects/:id')
  removeProject(@Param('id', ParseUUIDPipe) id: string) {
    return this.media.removeProjectMedia(id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('project_media:manage')
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
