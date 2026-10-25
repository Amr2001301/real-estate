import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { R2Service } from '../media/r2.service';
import { CompanyBrandingService } from '../company-branding/company-branding.service';
import { parseSha256List, type MobileAppAsset, type PresignMobileAppAssetDto, type PutCompanyMobileAppDto } from './mobile-apps.dto';

/** The shared customer and staff apps: no company's own app may take their ids. */
export const RESERVED_PACKAGE_IDS = new Set([
  'com.realestate.customer.mobile_customer',
  'com.realestate.staff.mobile_staff',
]);

const ASSET_MAX_BYTES: Record<MobileAppAsset, number> = {
  icon: 1024 * 1024,
  splash: 2 * 1024 * 1024,
};

const APP_SELECT = {
  appNameAr: true,
  appNameEn: true,
  packageId: true,
  iconUrl: true,
  splashUrl: true,
  status: true,
  playStoreUrl: true,
  appStoreUrl: true,
  androidSha256: true,
  updatedAt: true,
} satisfies Prisma.CompanyMobileAppSelect;

/**
 * Each company's own customer app in the stores — its name, package id and
 * icon — kept by the platform owner. The app build (and, later, the public
 * site's store links) read it; a company without one is served by the shared
 * customer app.
 */
@Injectable()
export class MobileAppsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
    // The public site reads the published app (store links, assetlinks.json)
    // from the branding, which is cached.
    private readonly branding: CompanyBrandingService,
  ) {}

  /** The company's app, with what a build also needs: its slug and brand colours. */
  async get(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        primaryColor: true,
        accentColor: true,
        mobileApp: { select: APP_SELECT },
        // The build opens these hosts' links in the app (Android App Links).
        companyDomains: { where: { companyId, verifiedAt: { not: null } }, select: { hostname: true } },
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    const { mobileApp, companyDomains, ...rest } = company;
    return { company: { ...rest, domains: companyDomains.map((d) => d.hostname) }, app: mobileApp };
  }

  async put(companyId: string, dto: PutCompanyMobileAppDto) {
    if (RESERVED_PACKAGE_IDS.has(dto.packageId)) {
      throw new BadRequestException('هذا المعرّف خاص بتطبيق المنصة العام — اختر معرّفًا للشركة');
    }
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) throw new NotFoundException('Company not found');
    const taken = await this.prisma.companyMobileApp.findFirst({
      where: { packageId: dto.packageId, companyId: { not: companyId } },
      select: { id: true },
    });
    if (taken) throw new ConflictException('معرّف التطبيق مستخدم لشركة أخرى');

    const data = {
      appNameAr: dto.appNameAr.trim(),
      appNameEn: dto.appNameEn.trim(),
      packageId: dto.packageId,
      ...(dto.iconUrl !== undefined ? { iconUrl: dto.iconUrl } : {}),
      ...(dto.splashUrl !== undefined ? { splashUrl: dto.splashUrl } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.playStoreUrl !== undefined ? { playStoreUrl: dto.playStoreUrl } : {}),
      ...(dto.appStoreUrl !== undefined ? { appStoreUrl: dto.appStoreUrl } : {}),
      ...(dto.androidSha256 !== undefined
        ? { androidSha256: parseSha256List(dto.androidSha256).join(',') || null }
        : {}),
    };
    try {
      await this.prisma.companyMobileApp.upsert({
        where: { companyId },
        create: { companyId, ...data },
        update: data,
      });
    } catch (err) {
      // Two saves racing for one package id: the unique index decides.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('معرّف التطبيق مستخدم لشركة أخرى');
      }
      throw err;
    }
    await this.branding.invalidate(companyId);
    return this.get(companyId);
  }

  /** The company goes back to the shared customer app. */
  async remove(companyId: string) {
    await this.prisma.companyMobileApp.deleteMany({ where: { companyId } });
    await this.branding.invalidate(companyId);
    return this.get(companyId);
  }

  presign(dto: PresignMobileAppAssetDto) {
    if (dto.contentType !== 'image/png') throw new BadRequestException('PNG only');
    if (dto.sizeBytes > ASSET_MAX_BYTES[dto.asset]) {
      throw new BadRequestException(`The ${dto.asset} exceeds the ${ASSET_MAX_BYTES[dto.asset]}-byte limit`);
    }
    return this.r2.createPresignedUpload({
      contentType: dto.contentType,
      folder: 'branding',
      sizeBytes: dto.sizeBytes,
    });
  }
}
