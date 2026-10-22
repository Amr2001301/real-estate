import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PrintSettings } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { imageExtension, imageSize } from '../../common/utils/report-brand';
import {
  CreateDocumentTemplateDto,
  PatchPrintSettingsDto,
  UpdateDocumentTemplateDto,
  type PrintAsset,
  type TemplateDocument,
} from './dto/print-settings.dto';

/** A signature or stamp image: small, PNG (transparent) or JPEG. */
export const PRINT_ASSET_MAX_BYTES = 512 * 1024;
const PRINT_ASSET_MAX_PX = 3000;

export interface UploadedPrintAsset {
  buffer: Buffer;
  size: number;
}

/** The settings as stored when the company has saved none. */
const DEFAULTS = {
  letterheadMode: 'BUILT_IN',
  headerImageUrl: null,
  footerImageUrl: null,
  pageImageUrl: null,
  marginTopMm: 14,
  marginBottomMm: 16,
  marginSideMm: 16,
  signatoryName: null,
  signatoryTitle: null,
  sealDocuments: [] as string[],
};

function dataUri(bytes: Uint8Array | Buffer | null, type: string | null): string | null {
  if (!bytes || !type) return null;
  return `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;
}

/**
 * How the company's documents print (P4): letterhead, margins, the
 * signature and stamp on final documents, and the wording of contracts and
 * booking forms. Every query names the company from the request context.
 */
@Injectable()
export class PrintSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private row(companyId: string) {
    return this.prisma.printSettings.findFirst({ where: { companyId } });
  }

  private present(row: PrintSettings | null) {
    const s = row ?? null;
    return {
      letterheadMode: s?.letterheadMode ?? DEFAULTS.letterheadMode,
      headerImageUrl: s?.headerImageUrl ?? null,
      footerImageUrl: s?.footerImageUrl ?? null,
      pageImageUrl: s?.pageImageUrl ?? null,
      marginTopMm: s?.marginTopMm ?? DEFAULTS.marginTopMm,
      marginBottomMm: s?.marginBottomMm ?? DEFAULTS.marginBottomMm,
      marginSideMm: s?.marginSideMm ?? DEFAULTS.marginSideMm,
      signatoryName: s?.signatoryName ?? null,
      signatoryTitle: s?.signatoryTitle ?? null,
      signature: dataUri(s?.signatureImage ?? null, s?.signatureType ?? null),
      stamp: dataUri(s?.stampImage ?? null, s?.stampType ?? null),
      sealDocuments: s?.sealDocuments ?? DEFAULTS.sealDocuments,
    };
  }

  /** The settings with the signature and stamp images (admin page and print pages). */
  async get() {
    return this.present(await this.row(getRequiredCompanyId()));
  }

  async update(dto: PatchPrintSettingsDto) {
    const companyId = getRequiredCompanyId();
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dto)) if (v !== undefined) data[k] = v;

    const current = await this.row(companyId);
    const next = { ...this.present(current), ...data };
    // A letterhead mode needs its paper.
    if (next.letterheadMode === 'HEADER_FOOTER' && !next.headerImageUrl && !next.footerImageUrl) {
      throw new BadRequestException('ارفع صورة رأس الورقة أو تذييلها أولاً');
    }
    if (next.letterheadMode === 'FULL_PAGE' && !next.pageImageUrl) {
      throw new BadRequestException('ارفع صورة الورقة كاملة أولاً');
    }

    const saved = current
      ? await this.prisma.printSettings.update({ where: { id: current.id }, data })
      : await this.prisma.printSettings.create({ data: { ...data, companyId } });
    return this.present(saved);
  }

  /** Saves the signature or stamp image after checking it is a real, small PNG/JPEG. */
  async setAsset(asset: PrintAsset, file: UploadedPrintAsset | undefined) {
    const companyId = getRequiredCompanyId();
    if (!file?.buffer?.length) throw new BadRequestException('اختر صورة');
    if (file.buffer.length > PRINT_ASSET_MAX_BYTES) {
      throw new BadRequestException('حجم الصورة أكبر من ٥١٢ كيلوبايت');
    }
    const ext = imageExtension(file.buffer);
    if (!ext) throw new BadRequestException('الصورة يجب أن تكون PNG أو JPEG');
    const size = imageSize(file.buffer);
    if (!size || size.width > PRINT_ASSET_MAX_PX || size.height > PRINT_ASSET_MAX_PX) {
      throw new BadRequestException('أبعاد الصورة غير مناسبة');
    }
    const type = ext === 'png' ? 'image/png' : 'image/jpeg';
    const data =
      asset === 'signature'
        ? { signatureImage: file.buffer, signatureType: type }
        : { stampImage: file.buffer, stampType: type };

    const current = await this.row(companyId);
    const saved = current
      ? await this.prisma.printSettings.update({ where: { id: current.id }, data })
      : await this.prisma.printSettings.create({ data: { ...data, companyId } });
    return this.present(saved);
  }

  async clearAsset(asset: PrintAsset) {
    const companyId = getRequiredCompanyId();
    const current = await this.row(companyId);
    if (!current) return this.present(null);
    const saved = await this.prisma.printSettings.update({
      where: { id: current.id },
      data:
        asset === 'signature'
          ? { signatureImage: null, signatureType: null }
          : { stampImage: null, stampType: null },
    });
    return this.present(saved);
  }

  // ── Templates ──────────────────────────────────────────────────────────────

  listTemplates(documentType?: TemplateDocument) {
    const companyId = getRequiredCompanyId();
    return this.prisma.documentTemplate.findMany({
      where: { companyId, ...(documentType ? { documentType } : {}) },
      orderBy: [{ documentType: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async getTemplate(id: string) {
    const companyId = getRequiredCompanyId();
    const t = await this.prisma.documentTemplate.findFirst({ where: { id, companyId } });
    if (!t) throw new NotFoundException('القالب غير موجود');
    return t;
  }

  async createTemplate(dto: CreateDocumentTemplateDto) {
    const companyId = getRequiredCompanyId();
    const variant = dto.documentType === 'CONTRACT' ? (dto.variant ?? 'ANY') : 'ANY';
    return this.prisma.$transaction(async (tx) => {
      // The first of its kind is the default.
      const others = await tx.documentTemplate.count({ where: { companyId, documentType: dto.documentType, variant } });
      const isDefault = dto.isDefault ?? others === 0;
      if (isDefault) {
        await tx.documentTemplate.updateMany({
          where: { companyId, documentType: dto.documentType, variant },
          data: { isDefault: false },
        });
      }
      return tx.documentTemplate.create({
        data: { companyId, documentType: dto.documentType, variant, name: dto.name, body: dto.body, isDefault },
      });
    });
  }

  async updateTemplate(id: string, dto: UpdateDocumentTemplateDto) {
    const companyId = getRequiredCompanyId();
    const current = await this.getTemplate(id);
    const variant = current.documentType === 'CONTRACT' ? (dto.variant ?? current.variant) : 'ANY';
    return this.prisma.$transaction(async (tx) => {
      // One default per document and sale type.
      const isDefault = dto.isDefault ?? (variant === current.variant ? current.isDefault : false);
      if (isDefault) {
        await tx.documentTemplate.updateMany({
          where: { companyId, documentType: current.documentType, variant, id: { not: id } },
          data: { isDefault: false },
        });
      }
      return tx.documentTemplate.update({
        where: { id },
        data: {
          variant,
          isDefault,
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.body !== undefined ? { body: dto.body } : {}),
        },
      });
    });
  }

  async deleteTemplate(id: string) {
    await this.getTemplate(id);
    await this.prisma.documentTemplate.deleteMany({ where: { id, companyId: getRequiredCompanyId() } });
    return { ok: true };
  }
}
