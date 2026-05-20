import {
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
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';

class UpsertPageDto {
  @IsString() slug!: string;
  @IsString() ar_title!: string;
  @IsString() en_title!: string;
  @IsString() ar_body!: string;
  @IsString() en_body!: string;
  @IsOptional() @IsBoolean() published?: boolean;
}

class UpsertBannerDto {
  @IsString() imageUrl!: string;
  @IsString() ar_title!: string;
  @IsString() en_title!: string;
  @IsOptional() @IsString() link?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(0) order?: number;
}

class UpsertArticleDto {
  @IsString() slug!: string;
  @IsString() ar_title!: string;
  @IsString() en_title!: string;
  @IsString() ar_excerpt!: string;
  @IsString() en_excerpt!: string;
  @IsString() ar_body!: string;
  @IsString() en_body!: string;
  @IsOptional() @IsString() coverUrl?: string;
  @IsOptional() @IsBoolean() published?: boolean;
}

@Injectable()
class CmsService {
  constructor(private readonly prisma: PrismaService) {}

  // Pages
  upsertPage(dto: UpsertPageDto) {
    return this.prisma.cmsPage.upsert({
      where: { slug: dto.slug },
      create: {
        slug: dto.slug,
        title: { ar: dto.ar_title, en: dto.en_title } as Prisma.InputJsonValue,
        body: { ar: dto.ar_body, en: dto.en_body } as Prisma.InputJsonValue,
        published: dto.published ?? false,
      },
      update: {
        title: { ar: dto.ar_title, en: dto.en_title } as Prisma.InputJsonValue,
        body: { ar: dto.ar_body, en: dto.en_body } as Prisma.InputJsonValue,
        published: dto.published ?? undefined,
      },
    });
  }

  getPage(slug: string, publicOnly = false) {
    return this.prisma.cmsPage.findFirst({
      where: { slug, ...(publicOnly ? { published: true } : {}) },
    });
  }

  listPages(publicOnly = false) {
    return this.prisma.cmsPage.findMany({
      where: publicOnly ? { published: true } : {},
      orderBy: { updatedAt: 'desc' },
    });
  }

  // Banners
  listBanners(publicOnly = false) {
    return this.prisma.banner.findMany({
      where: publicOnly ? { active: true } : {},
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
  }

  createBanner(dto: UpsertBannerDto) {
    return this.prisma.banner.create({
      data: {
        imageUrl: dto.imageUrl,
        title: { ar: dto.ar_title, en: dto.en_title } as Prisma.InputJsonValue,
        link: dto.link ?? null,
        active: dto.active ?? true,
        order: dto.order ?? 0,
      },
    });
  }

  removeBanner(id: string) {
    return this.prisma.banner.delete({ where: { id } });
  }

  // Articles
  upsertArticle(dto: UpsertArticleDto) {
    return this.prisma.article.upsert({
      where: { slug: dto.slug },
      create: {
        slug: dto.slug,
        title: { ar: dto.ar_title, en: dto.en_title } as Prisma.InputJsonValue,
        excerpt: { ar: dto.ar_excerpt, en: dto.en_excerpt } as Prisma.InputJsonValue,
        body: { ar: dto.ar_body, en: dto.en_body } as Prisma.InputJsonValue,
        coverUrl: dto.coverUrl ?? null,
        published: dto.published ?? false,
      },
      update: {
        title: { ar: dto.ar_title, en: dto.en_title } as Prisma.InputJsonValue,
        excerpt: { ar: dto.ar_excerpt, en: dto.en_excerpt } as Prisma.InputJsonValue,
        body: { ar: dto.ar_body, en: dto.en_body } as Prisma.InputJsonValue,
        coverUrl: dto.coverUrl ?? undefined,
        published: dto.published ?? undefined,
      },
    });
  }

  listArticles(publicOnly = false) {
    return this.prisma.article.findMany({
      where: publicOnly ? { published: true } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  getArticle(slug: string, publicOnly = false) {
    return this.prisma.article.findFirst({
      where: { slug, ...(publicOnly ? { published: true } : {}) },
    });
  }
}

@ApiTags('cms')
@Controller()
class CmsController {
  constructor(private readonly svc: CmsService) {}

  // Public
  @Public()
  @Get('public/banners')
  publicBanners() {
    return this.svc.listBanners(true);
  }

  @Public()
  @Get('public/pages/:slug')
  publicPage(@Param('slug') slug: string) {
    return this.svc.getPage(slug, true);
  }

  @Public()
  @Get('public/articles')
  publicArticles() {
    return this.svc.listArticles(true);
  }

  @Public()
  @Get('public/articles/:slug')
  publicArticle(@Param('slug') slug: string) {
    return this.svc.getArticle(slug, true);
  }

  // Admin — Pages
  @Roles(UserRole.ADMIN)
  @Permissions('cms:pages:manage')
  @Get('cms/pages')
  listPages() {
    return this.svc.listPages();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('cms:pages:manage')
  @Post('cms/pages')
  upsertPage(@Body() dto: UpsertPageDto) {
    return this.svc.upsertPage(dto);
  }

  // Admin — Banners
  @Roles(UserRole.ADMIN)
  @Permissions('cms:banners:manage')
  @Get('cms/banners')
  listBanners() {
    return this.svc.listBanners();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('cms:banners:manage')
  @Post('cms/banners')
  createBanner(@Body() dto: UpsertBannerDto) {
    return this.svc.createBanner(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('cms:banners:manage')
  @Delete('cms/banners/:id')
  removeBanner(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeBanner(id);
  }

  // Admin — Articles
  @Roles(UserRole.ADMIN)
  @Permissions('cms:articles:manage')
  @Get('cms/articles')
  listArticles() {
    return this.svc.listArticles();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('cms:articles:manage')
  @Post('cms/articles')
  upsertArticle(@Body() dto: UpsertArticleDto) {
    return this.svc.upsertArticle(dto);
  }
}

@Module({
  controllers: [CmsController],
  providers: [CmsService],
})
export class CmsModule {}
