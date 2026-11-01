import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { GrantedBy } from '../../common/decorators/granted-by.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';

/** A page's address on the site: lower-case letters, digits and dashes (about, privacy-policy). */
const PAGE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Where a banner may send the visitor: a page of the site (/projects) or a web address. */
const BANNER_LINK = /^(\/(?!\/)\S*|https?:\/\/\S+)$/;

class UpsertPageDto {
  @IsString() @MaxLength(80) @Matches(PAGE_SLUG, { message: 'رابط الصفحة: حروف إنجليزية صغيرة وأرقام وشَرطة فقط (مثال: about)' })
  slug!: string;
  @IsString() ar_title!: string;
  @IsString() en_title!: string;
  @IsString() ar_body!: string;
  @IsString() en_body!: string;
  @IsOptional() @IsBoolean() published?: boolean;
}

class UpsertBannerDto {
  @IsString() @Matches(/^https?:\/\/\S+$/, { message: 'صورة البانر لازم تكون رابط يبدأ بـ http أو https' })
  imageUrl!: string;
  @IsString() ar_title!: string;
  @IsString() en_title!: string;
  @IsOptional() @IsString() @MaxLength(500) @Matches(BANNER_LINK, { message: 'رابط البانر يبدأ بـ / (صفحة في الموقع) أو بـ https://' })
  link?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(0) order?: number;
}

class UpdateBannerDto {
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

  // Pages — a slug is unique per company, so saving finds the company's own
  // page first (the tenant scope narrows the lookup) and updates or creates it.
  async upsertPage(dto: UpsertPageDto) {
    const title = { ar: dto.ar_title, en: dto.en_title } as Prisma.InputJsonValue;
    const body = { ar: dto.ar_body, en: dto.en_body } as Prisma.InputJsonValue;
    const existing = await this.prisma.cmsPage.findFirst({ where: { slug: dto.slug }, select: { id: true } });
    if (existing) {
      return this.prisma.cmsPage.update({
        where: { id: existing.id },
        data: { title, body, published: dto.published ?? undefined },
      });
    }
    return this.prisma.cmsPage.create({
      data: { slug: dto.slug, title, body, published: dto.published ?? false },
    });
  }

  getPage(slug: string, publicOnly = false) {
    return this.prisma.cmsPage.findFirst({
      where: { slug, ...(publicOnly ? { published: true } : {}) },
    });
  }

  async publicPage(slug: string) {
    const page = await this.getPage(slug, true);
    if (!page) throw new NotFoundException('الصفحة غير موجودة');
    return page;
  }

  /** The published pages, for the site's footer and sitemap. */
  listPublicPages() {
    return this.prisma.cmsPage.findMany({
      where: { published: true },
      select: { slug: true, title: true, updatedAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async removePage(id: string) {
    const { count } = await this.prisma.cmsPage.deleteMany({ where: { id } });
    if (!count) throw new NotFoundException('الصفحة غير موجودة');
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

  async updateBanner(id: string, dto: UpdateBannerDto) {
    const { count } = await this.prisma.banner.updateMany({
      where: { id },
      data: { active: dto.active, order: dto.order },
    });
    if (!count) throw new NotFoundException('البانر غير موجود');
    return this.prisma.banner.findFirst({ where: { id } });
  }

  async removeBanner(id: string) {
    const { count } = await this.prisma.banner.deleteMany({ where: { id } });
    if (!count) throw new NotFoundException('البانر غير موجود');
  }

  // Articles — a slug is unique per company, as for pages.
  async upsertArticle(dto: UpsertArticleDto) {
    const title = { ar: dto.ar_title, en: dto.en_title } as Prisma.InputJsonValue;
    const excerpt = { ar: dto.ar_excerpt, en: dto.en_excerpt } as Prisma.InputJsonValue;
    const body = { ar: dto.ar_body, en: dto.en_body } as Prisma.InputJsonValue;
    const existing = await this.prisma.article.findFirst({ where: { slug: dto.slug }, select: { id: true } });
    if (existing) {
      return this.prisma.article.update({
        where: { id: existing.id },
        data: { title, excerpt, body, coverUrl: dto.coverUrl ?? undefined, published: dto.published ?? undefined },
      });
    }
    return this.prisma.article.create({
      data: { slug: dto.slug, title, excerpt, body, coverUrl: dto.coverUrl ?? null, published: dto.published ?? false },
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
  @Get('public/pages')
  publicPages() {
    return this.svc.listPublicPages();
  }

  @Public()
  @Get('public/pages/:slug')
  publicPage(@Param('slug') slug: string) {
    return this.svc.publicPage(slug);
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
  @GrantedBy('cms:pages:manage')
  @Get('cms/pages')
  listPages() {
    return this.svc.listPages();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('cms:pages:manage')
  @GrantedBy('cms:pages:manage')
  @Post('cms/pages')
  upsertPage(@Body() dto: UpsertPageDto) {
    return this.svc.upsertPage(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('cms:pages:manage')
  @GrantedBy('cms:pages:manage')
  @Delete('cms/pages/:id')
  removePage(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removePage(id);
  }

  // Admin — Banners
  @Roles(UserRole.ADMIN)
  @Permissions('cms:banners:manage')
  @GrantedBy('cms:banners:manage')
  @Get('cms/banners')
  listBanners() {
    return this.svc.listBanners();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('cms:banners:manage')
  @GrantedBy('cms:banners:manage')
  @Post('cms/banners')
  createBanner(@Body() dto: UpsertBannerDto) {
    return this.svc.createBanner(dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('cms:banners:manage')
  @GrantedBy('cms:banners:manage')
  @Patch('cms/banners/:id')
  updateBanner(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBannerDto) {
    return this.svc.updateBanner(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('cms:banners:manage')
  @GrantedBy('cms:banners:manage')
  @Delete('cms/banners/:id')
  removeBanner(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeBanner(id);
  }

  // Admin — Articles
  @Roles(UserRole.ADMIN)
  @Permissions('cms:articles:manage')
  @GrantedBy('cms:articles:manage')
  @Get('cms/articles')
  listArticles() {
    return this.svc.listArticles();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('cms:articles:manage')
  @GrantedBy('cms:articles:manage')
  @Get('cms/articles/:slug')
  getArticle(@Param('slug') slug: string) {
    return this.svc.getArticle(slug);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('cms:articles:manage')
  @GrantedBy('cms:articles:manage')
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
