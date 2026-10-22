import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { CUSTOMER_FIELD_KEY, CreateCustomerFieldDto, UpdateCustomerFieldDto } from './dto/customer-field.dto';

const SELECT = { id: true, key: true, label: true, type: true, options: true, active: true, order: true } as const;

/** A key from an English label: "Spouse name" → spouse_name. */
export function keyFromLabel(en: string): string {
  const k = en
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^[^a-z]+/, '')
    .replace(/_+$/, '')
    .slice(0, 40)
    .replace(/_+$/, '');
  return CUSTOMER_FIELD_KEY.test(k) ? k : '';
}

/**
 * The company's own customer fields: extra data its staff keep on a buyer
 * beyond the fixed ones, printed on its forms as {{custom.<key>}}. The key
 * and the type are fixed once created; a field no longer wanted is turned
 * off, so the values customers hold are kept.
 */
@Injectable()
export class CustomerFieldsService {
  constructor(private readonly prisma: PrismaService) {}

  list(activeOnly = false) {
    const companyId = getRequiredCompanyId();
    return this.prisma.customerField.findMany({
      where: { companyId, ...(activeOnly ? { active: true } : {}) },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: SELECT,
    });
  }

  async create(dto: CreateCustomerFieldDto) {
    const companyId = getRequiredCompanyId();
    const options = dto.type === 'SELECT' ? (dto.options ?? []) : [];
    if (dto.type === 'SELECT' && options.length === 0) throw new BadRequestException('أضف اختياراً واحداً على الأقل');
    let key = dto.key ?? keyFromLabel(dto.en);
    const taken = new Set(
      (await this.prisma.customerField.findMany({ where: { companyId }, select: { key: true } })).map((r) => r.key),
    );
    if (dto.key && taken.has(key)) throw new ConflictException('يوجد خانة بنفس المفتاح');
    if (!key) key = 'field';
    // A derived key steps aside: field, field_2, …
    if (!dto.key && taken.has(key)) {
      const stem = key.slice(0, 36);
      let n = 2;
      while (taken.has(`${stem}_${n}`)) n++;
      key = `${stem}_${n}`;
    }
    const last = await this.prisma.customerField.findFirst({
      where: { companyId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    return this.prisma.customerField.create({
      data: {
        companyId,
        key,
        label: { ar: dto.ar, en: dto.en },
        type: dto.type,
        options,
        order: (last?.order ?? -1) + 1,
      },
      select: SELECT,
    });
  }

  async update(id: string, dto: UpdateCustomerFieldDto) {
    const companyId = getRequiredCompanyId();
    const current = await this.prisma.customerField.findFirst({ where: { id, companyId } });
    if (!current) throw new NotFoundException('Customer field not found');
    if (dto.options !== undefined && current.type !== 'SELECT') {
      throw new BadRequestException('الاختيارات لخانة الاختيار من قائمة فقط');
    }
    if (dto.options !== undefined && dto.options.length === 0) {
      throw new BadRequestException('أضف اختياراً واحداً على الأقل');
    }
    const prev = (current.label ?? {}) as { ar?: string; en?: string };
    const relabel = dto.ar !== undefined || dto.en !== undefined;
    await this.prisma.customerField.updateMany({
      where: { id, companyId },
      data: {
        ...(relabel ? { label: { ar: dto.ar ?? prev.ar ?? '', en: dto.en ?? prev.en ?? '' } } : {}),
        ...(dto.options !== undefined ? { options: dto.options } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
      },
    });
    return this.prisma.customerField.findFirstOrThrow({ where: { id, companyId }, select: SELECT });
  }

}
