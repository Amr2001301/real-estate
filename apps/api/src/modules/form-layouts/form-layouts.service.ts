import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { DOCUMENT_PAPER, type FormDocument, type SaveFormLayoutDto } from './dto/form-layout.dto';

/**
 * The company's own paper forms: their pages and where each value goes on
 * them, for the booking form and the payment receipt. One default per
 * document; the print page (and, for a booking form, the signing page) use it
 * in place of the platform's layout. Every query names the company.
 */
@Injectable()
export class FormLayoutsService {
  constructor(private readonly prisma: PrismaService) {}

  list(documentType?: FormDocument) {
    const companyId = getRequiredCompanyId();
    return this.prisma.formLayout.findMany({
      where: { companyId, ...(documentType ? { documentType } : {}) },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async get(id: string) {
    const companyId = getRequiredCompanyId();
    const f = await this.prisma.formLayout.findFirst({ where: { id, companyId } });
    if (!f) throw new NotFoundException('النموذج غير موجود');
    return f;
  }

  /**
   * Fields sit on a page that exists, inside it; the paper suits the
   * document; a receipt has no customer's signature box (the payer does not
   * sign it). On a booking form the customer signs online; on a contract the
   * box is left for the signature in ink.
   */
  private check(dto: SaveFormLayoutDto, documentType: FormDocument) {
    if (!DOCUMENT_PAPER[documentType].includes(dto.paperSize ?? 'A4')) {
      throw new BadRequestException('مقاس الورق غير متاح لهذا المستند');
    }
    for (const f of dto.fields) {
      if (f.key === 'sign.customer' && documentType === 'RECEIPT') {
        throw new BadRequestException('لا يوجد توقيع للعميل على الإيصال');
      }
      if (f.page >= dto.pages.length) throw new BadRequestException('خانة على صفحة غير موجودة');
      if (f.x + f.w > 1.0001 || f.y + f.h > 1.0001) throw new BadRequestException('خانة خارج حدود الصفحة');
    }
    if (new Set(dto.fields.map((f) => f.id)).size !== dto.fields.length) {
      throw new BadRequestException('خانات مكررة');
    }
  }

  private data(dto: SaveFormLayoutDto) {
    return {
      name: dto.name.trim(),
      paperSize: dto.paperSize ?? 'A4',
      pages: dto.pages.map((p) => ({ imageUrl: p.imageUrl })),
      fields: dto.fields.map((f) => ({
        id: f.id,
        key: f.key,
        page: f.page,
        x: f.x,
        y: f.y,
        w: f.w,
        h: f.h,
        size: f.size,
        align: f.align,
        bold: !!f.bold,
      })),
    };
  }

  async create(dto: SaveFormLayoutDto) {
    const companyId = getRequiredCompanyId();
    this.check(dto, dto.documentType);
    return this.prisma.$transaction(async (tx) => {
      const others = await tx.formLayout.count({ where: { companyId, documentType: dto.documentType } });
      const isDefault = dto.isDefault ?? others === 0;
      if (isDefault) {
        await tx.formLayout.updateMany({ where: { companyId, documentType: dto.documentType }, data: { isDefault: false } });
      }
      return tx.formLayout.create({
        data: { companyId, documentType: dto.documentType, isDefault, ...this.data(dto) },
      });
    });
  }

  async update(id: string, dto: SaveFormLayoutDto) {
    const companyId = getRequiredCompanyId();
    const current = await this.get(id);
    // The document is fixed once created; its prints and signatures refer to it.
    if (dto.documentType !== current.documentType) throw new BadRequestException('لا يمكن تغيير نوع المستند');
    this.check(dto, current.documentType as FormDocument);
    return this.prisma.$transaction(async (tx) => {
      const isDefault = dto.isDefault ?? current.isDefault;
      if (isDefault) {
        await tx.formLayout.updateMany({
          where: { companyId, documentType: current.documentType, id: { not: id } },
          data: { isDefault: false },
        });
      }
      await tx.formLayout.updateMany({ where: { id, companyId }, data: { isDefault, ...this.data(dto) } });
      return tx.formLayout.findFirstOrThrow({ where: { id, companyId } });
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.formLayout.deleteMany({ where: { id, companyId: getRequiredCompanyId() } });
    return { ok: true };
  }
}
