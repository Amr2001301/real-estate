import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProjectStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateProjectDto, ProjectQueryDto, UpdateProjectDto } from './dto/project.dto';
import { paginate, takeSkip } from '../../common/utils/pagination';
import {
  serializePublicProjectDetail,
  serializePublicProjectListItem,
} from './public-project.serializer';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        name: dto.name as unknown as Prisma.InputJsonValue,
        description: dto.description as unknown as Prisma.InputJsonValue,
        city: dto.city,
        lat: dto.lat,
        lng: dto.lng,
        status: dto.status ?? ProjectStatus.DRAFT,
        featured: dto.featured ?? false,
        services: (dto.services ?? []) as unknown as Prisma.InputJsonValue,
      },
      include: { media: true },
    });
  }

  async findAll(query: ProjectQueryDto, publicOnly = false) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ProjectWhereInput = {
      ...(publicOnly ? { status: ProjectStatus.PUBLISHED } : {}),
      ...(query.city ? { city: query.city } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.featured !== undefined ? { featured: query.featured } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { path: ['ar'], string_contains: query.q } },
              { name: { path: ['en'], string_contains: query.q } },
              { city: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        ...takeSkip({ page, pageSize }),
        orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
        include: { media: { orderBy: { order: 'asc' }, take: 1 } },
      }),
      this.prisma.project.count({ where }),
    ]);

    if (publicOnly) {
      const counts = await this.availableUnitCounts(data.map((p) => p.id));
      const serialized = data.map((p) =>
        serializePublicProjectListItem(p, counts.get(p.id) ?? 0),
      );
      return paginate(serialized, total, { page, pageSize });
    }

    return paginate(data, total, { page, pageSize });
  }

  /**
   * Count AVAILABLE units per project in a single query (units have no direct
   * projectId, so we walk building → phase → projectId and tally in JS).
   */
  private async availableUnitCounts(projectIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (projectIds.length === 0) return counts;
    const units = await this.prisma.unit.findMany({
      where: {
        status: 'AVAILABLE',
        building: { phase: { projectId: { in: projectIds } } },
      },
      select: { building: { select: { phase: { select: { projectId: true } } } } },
    });
    for (const u of units) {
      const pid = u.building.phase.projectId;
      counts.set(pid, (counts.get(pid) ?? 0) + 1);
    }
    return counts;
  }

  async findOne(id: string, publicOnly = false) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        media: { orderBy: { order: 'asc' } },
        phases: {
          include: { buildings: { include: { _count: { select: { units: true } } } } },
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (publicOnly && project.status !== ProjectStatus.PUBLISHED) {
      throw new NotFoundException('Project not found');
    }
    if (publicOnly) {
      const counts = await this.availableUnitCounts([project.id]);
      return serializePublicProjectDetail(project, counts.get(project.id) ?? 0);
    }
    return project;
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.assertExists(id);
    const data: Prisma.ProjectUpdateInput = {};
    if (dto.name) data.name = dto.name as unknown as Prisma.InputJsonValue;
    if (dto.description) data.description = dto.description as unknown as Prisma.InputJsonValue;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.lat !== undefined) data.lat = dto.lat;
    if (dto.lng !== undefined) data.lng = dto.lng;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.featured !== undefined) data.featured = dto.featured;
    if (dto.services) data.services = dto.services as unknown as Prisma.InputJsonValue;

    return this.prisma.project.update({
      where: { id },
      data,
      include: { media: true },
    });
  }

  async remove(id: string) {
    await this.assertExists(id);

    const [reservations, contracts, maintenance, activeUnits, visitRequests] =
      await this.prisma.$transaction([
        this.prisma.reservation.count({
          where: { unit: { building: { phase: { projectId: id } } } },
        }),
        this.prisma.contract.count({
          where: { unit: { building: { phase: { projectId: id } } } },
        }),
        this.prisma.maintenanceRequest.count({
          where: { unit: { building: { phase: { projectId: id } } } },
        }),
        this.prisma.unit.count({
          where: {
            building: { phase: { projectId: id } },
            status: { in: ['SOLD', 'RESERVED'] },
          },
        }),
        this.prisma.visitRequest.count({ where: { projectId: id } }),
      ]);

    const blockers: string[] = [];
    if (reservations > 0) blockers.push(`${reservations} حجز`);
    if (contracts > 0) blockers.push(`${contracts} عقد`);
    if (maintenance > 0) blockers.push(`${maintenance} طلب صيانة`);
    if (activeUnits > 0) blockers.push(`${activeUnits} وحدة محجوزة أو مباعة`);
    if (visitRequests > 0) blockers.push(`${visitRequests} طلب زيارة`);

    if (blockers.length > 0) {
      throw new ConflictException(
        `لا يمكن حذف المشروع لأنه مرتبط بـ: ${blockers.join('، ')}. يجب إزالة أو نقل هذه السجلات أولاً.`,
      );
    }

    return this.prisma.project.delete({ where: { id } });
  }

  async publish(id: string) {
    await this.assertExists(id);
    return this.prisma.project.update({
      where: { id },
      data: { status: ProjectStatus.PUBLISHED },
    });
  }

  async archive(id: string) {
    await this.assertExists(id);
    return this.prisma.project.update({
      where: { id },
      data: { status: ProjectStatus.ARCHIVED },
    });
  }

  private async assertExists(id: string) {
    const exists = await this.prisma.project.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Project not found');
  }
}
