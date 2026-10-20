import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UnitUsage } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { CreateUnitModelDto, UpdateUnitModelDto } from './dto/unit-model.dto';
import { UnitTypesService } from './unit-types.service';

const MODEL_FIELDS = [
  'area',
  'netArea',
  'gardenArea',
  'roofArea',
  'terraceArea',
  'landArea',
  'bedrooms',
  'bathrooms',
  'finishing',
] as const;

/**
 * A project's unit models (F10): a layout — type, areas, rooms, finishing —
 * a unit is entered from. The unit form fills the unit from its model; the
 * unit keeps its own values after, so editing a model changes no unit.
 * Optional: a project may have none.
 */
@Injectable()
export class UnitModelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly unitTypes: UnitTypesService,
  ) {}

  async list(projectId: string, activeOnly = false) {
    const companyId = getRequiredCompanyId();
    await this.project(projectId);
    return this.prisma.unitModel.findMany({
      where: { companyId, projectId, ...(activeOnly ? { active: true } : {}) },
      orderBy: [{ code: 'asc' }],
      include: { _count: { select: { units: true } } },
    });
  }

  async create(projectId: string, dto: CreateUnitModelDto) {
    const companyId = getRequiredCompanyId();
    await this.project(projectId);
    const code = dto.code.trim().toUpperCase();
    const taken = await this.prisma.unitModel.findFirst({ where: { companyId, projectId, code }, select: { id: true } });
    if (taken) throw new ConflictException('يوجد نموذج بنفس الكود في هذا المشروع');
    const type = await this.unitTypes.resolveActive(dto.type);
    return this.prisma.unitModel.create({
      data: {
        companyId,
        projectId,
        code,
        name: { ar: dto.ar.trim(), en: dto.en.trim() },
        type: type.code,
        ...this.fields(dto, type.usage),
        area: dto.area,
      },
    });
  }

  async update(id: string, dto: UpdateUnitModelDto) {
    const companyId = getRequiredCompanyId();
    const current = await this.prisma.unitModel.findFirst({ where: { id, companyId } });
    if (!current) throw new NotFoundException('النموذج غير موجود');
    const type = dto.type !== undefined ? await this.unitTypes.resolveActive(dto.type) : await this.unitTypes.resolve(current.type);
    const prev = (current.name ?? {}) as { ar?: string; en?: string };
    return this.prisma.unitModel.update({
      where: { id },
      data: {
        ...(dto.ar !== undefined || dto.en !== undefined
          ? { name: { ar: (dto.ar ?? prev.ar ?? '').trim(), en: (dto.en ?? prev.en ?? '').trim() } }
          : {}),
        ...(dto.type !== undefined ? { type: type.code } : {}),
        ...this.fields(dto, type.usage),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
  }

  /**
   * The model a unit is entered from: this company's, of the unit's own
   * project, and switched on when newly given.
   */
  async forUnit(modelId: string, buildingId: string, keep = false) {
    const companyId = getRequiredCompanyId();
    const [model, building] = await Promise.all([
      this.prisma.unitModel.findFirst({ where: { id: modelId, companyId }, select: { id: true, projectId: true, active: true } }),
      this.prisma.building.findFirst({ where: { id: buildingId, companyId }, select: { phase: { select: { projectId: true } } } }),
    ]);
    if (!model) throw new BadRequestException('النموذج غير موجود');
    if (building?.phase.projectId !== model.projectId) {
      throw new BadRequestException('النموذج من مشروع آخر غير مشروع الوحدة');
    }
    if (!model.active && !keep) throw new BadRequestException('النموذج موقوف');
    return model;
  }

  private async project(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId: getRequiredCompanyId() },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('المشروع غير موجود');
  }

  /** The layout fields sent (only a residential model has bedrooms). */
  private fields(dto: CreateUnitModelDto | UpdateUnitModelDto, usage: UnitUsage) {
    const data: Partial<Record<(typeof MODEL_FIELDS)[number], unknown>> = {};
    for (const f of MODEL_FIELDS) if (dto[f] !== undefined) data[f] = dto[f];
    if (usage !== UnitUsage.RESIDENTIAL) data.bedrooms = 0;
    return data as Partial<Pick<Prisma.UnitModelUncheckedCreateInput, (typeof MODEL_FIELDS)[number]>>;
  }
}
