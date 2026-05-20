import {
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
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { MediaType, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { R2Service } from './r2.service';

class CreatePresignedDto {
  @IsString()
  contentType!: string;

  @IsIn(['projects', 'units', 'contracts', 'receipts', 'maintenance', 'banners'])
  folder!: 'projects' | 'units' | 'contracts' | 'receipts' | 'maintenance' | 'banners';

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
    return this.r2.createPresignedUpload(dto);
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
