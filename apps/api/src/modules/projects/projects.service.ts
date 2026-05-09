import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProjectStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateProjectDto, ProjectQueryDto, UpdateProjectDto } from './dto/project.dto';
import { paginate, takeSkip } from '../../common/utils/pagination';

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

    return paginate(data, total, { page, pageSize });
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
