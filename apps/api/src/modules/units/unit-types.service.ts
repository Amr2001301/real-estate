import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UnitUsage } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUnitTypeDto, UpdateUnitTypeDto } from './dto/unit-type.dto';

type Name = { ar?: string; en?: string };

export interface ResolvedUnitType {
  code: string;
  usage: UnitUsage;
  active: boolean;
}

/**
 * The company's unit types (F10). Unit.type holds a type's code: the code is
 * fixed once created (units and filters refer to it); the names, the usage
 * and the active flag are the admin's to change.
 */
@Injectable()
export class UnitTypesService {
  constructor(private readonly prisma: PrismaService) {}

  list(activeOnly = false) {
    return this.prisma.unitType.findMany({
      where: activeOnly ? { active: true } : {},
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, code: true, name: true, usage: true, active: true, order: true },
    });
  }

  /** code → name, for showing a unit's type by its name. */
  async names(): Promise<Map<string, Prisma.JsonValue>> {
    const rows = await this.prisma.unitType.findMany({ select: { code: true, name: true } });
    return new Map(rows.map((r) => [r.code, r.name]));
  }

  /**
   * The company's type a unit form or import gave: matched on the code or
   * either name, any case ("villa", "فيلا" → Villa). Unknown → 400.
   */
  async resolve(input: string): Promise<ResolvedUnitType> {
    const needle = input.trim().toLowerCase();
    const rows = await this.prisma.unitType.findMany({
      select: { code: true, name: true, usage: true, active: true },
    });
    const hit =
      rows.find((r) => r.code.toLowerCase() === needle) ??
      rows.find((r) => {
        const n = (r.name ?? {}) as Name;
        return n.ar?.trim().toLowerCase() === needle || n.en?.trim().toLowerCase() === needle;
      });
    if (!hit) {
      throw new BadRequestException(`نوع الوحدة «${input}» غير موجود — أضفه من صفحة أنواع الوحدات`);
    }
    return { code: hit.code, usage: hit.usage, active: hit.active };
  }

  /** As resolve(), for a unit being given this type now: the type must be on. */
  async resolveActive(input: string): Promise<ResolvedUnitType> {
    const t = await this.resolve(input);
    if (!t.active) throw new BadRequestException(`نوع الوحدة «${t.code}» موقوف`);
    return t;
  }

  async create(dto: CreateUnitTypeDto) {
    const ar = dto.ar.trim();
    const en = dto.en.trim();
    const code = (dto.code ?? en).trim();
    if (!code) throw new BadRequestException('كود النوع مطلوب');
    await this.assertFree(code, ar, en);
    const last = await this.prisma.unitType.findFirst({ orderBy: { order: 'desc' }, select: { order: true } });
    return this.prisma.unitType.create({
      data: { code, name: { ar, en }, usage: dto.usage, order: (last?.order ?? -1) + 1 },
    });
  }

  async update(id: string, dto: UpdateUnitTypeDto) {
    const current = await this.prisma.unitType.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Unit type not found');
    const prev = (current.name ?? {}) as Name;
    const ar = (dto.ar ?? prev.ar ?? '').trim();
    const en = (dto.en ?? prev.en ?? '').trim();
    if (dto.ar !== undefined || dto.en !== undefined) await this.assertFree(null, ar, en, id);
    const updated = await this.prisma.unitType.update({
      where: { id },
      data: {
        ...(dto.ar !== undefined || dto.en !== undefined ? { name: { ar, en } } : {}),
        ...(dto.usage !== undefined ? { usage: dto.usage } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
    // The units of this type follow its usage (filters and the bedroom
    // field read the unit's own).
    if (dto.usage !== undefined && dto.usage !== current.usage) {
      await this.prisma.unit.updateMany({ where: { type: current.code }, data: { usage: dto.usage } });
    }
    return updated;
  }

  private async assertFree(code: string | null, ar: string, en: string, exceptId?: string) {
    const rows = await this.prisma.unitType.findMany({ select: { id: true, code: true, name: true } });
    for (const r of rows) {
      if (r.id === exceptId) continue;
      const n = (r.name ?? {}) as Name;
      if (code && r.code.toLowerCase() === code.toLowerCase()) {
        throw new ConflictException('يوجد نوع بنفس الكود');
      }
      if (
        (ar && n.ar?.trim().toLowerCase() === ar.toLowerCase()) ||
        (en && n.en?.trim().toLowerCase() === en.toLowerCase())
      ) {
        throw new ConflictException('يوجد نوع بنفس الاسم');
      }
    }
  }
}
