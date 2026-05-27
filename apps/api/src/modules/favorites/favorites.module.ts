import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

class CreateFavoriteDto {
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() unitId?: string;
}

@Injectable()
class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        project: { include: { media: { take: 1, orderBy: { order: 'asc' } } } },
        unit: { include: { media: { take: 1, orderBy: { order: 'asc' } } } },
      },
    });
  }

  async add(userId: string, dto: CreateFavoriteDto) {
    if (!dto.projectId && !dto.unitId) {
      throw new BadRequestException('Either projectId or unitId is required');
    }
    const existing = await this.prisma.favorite.findFirst({
      where: {
        userId,
        projectId: dto.projectId ?? null,
        unitId: dto.unitId ?? null,
      },
    });
    if (existing) return existing;
    return this.prisma.favorite.create({
      data: {
        userId,
        projectId: dto.projectId ?? null,
        unitId: dto.unitId ?? null,
      },
    });
  }

  remove(userId: string, id: string) {
    return this.prisma.favorite.deleteMany({ where: { id, userId } });
  }

  // Mobile-friendly favorite status: the project/unit ids the user has saved.
  async listIds(userId: string): Promise<{ projectIds: string[]; unitIds: string[] }> {
    const favs = await this.prisma.favorite.findMany({
      where: { userId },
      select: { projectId: true, unitId: true },
    });
    return {
      projectIds: favs.map((f) => f.projectId).filter((v): v is string => v !== null),
      unitIds: favs.map((f) => f.unitId).filter((v): v is string => v !== null),
    };
  }
}

@ApiTags('favorites')
@Controller('me/favorites')
class FavoritesController {
  constructor(private readonly svc: FavoritesService) {}

  @Roles(UserRole.CLIENT, UserRole.CUSTOMER)
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.svc.list(user.sub);
  }

  @Roles(UserRole.CLIENT, UserRole.CUSTOMER)
  @Get('ids')
  ids(@CurrentUser() user: AuthUser) {
    return this.svc.listIds(user.sub);
  }

  @Roles(UserRole.CLIENT, UserRole.CUSTOMER)
  @Post()
  add(@CurrentUser() user: AuthUser, @Body() dto: CreateFavoriteDto) {
    return this.svc.add(user.sub, dto);
  }

  @Roles(UserRole.CLIENT, UserRole.CUSTOMER)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(user.sub, id);
  }
}

@Module({
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
