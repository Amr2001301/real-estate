import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { paginate, takeSkip } from '../../common/utils/pagination';

@Injectable()
class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: {
    page: number;
    pageSize: number;
    actorId?: string;
    entityType?: string;
    entityId?: string;
  }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(opts.actorId ? { actorId: opts.actorId } : {}),
      ...(opts.entityType ? { entityType: { contains: opts.entityType } } : {}),
      ...(opts.entityId ? { entityId: opts.entityId } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        ...takeSkip(opts),
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, fullName: true, role: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginate(data, total, opts);
  }
}

@ApiTags('audit')
@Controller('audit-logs')
class AuditController {
  constructor(private readonly svc: AuditService) {}

  @Roles(UserRole.ADMIN)
  @Get()
  list(
    @Query('actorId') actorId?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.svc.list({
      page: Number(page),
      pageSize: Number(pageSize),
      actorId,
      entityType,
      entityId,
    });
  }
}

@Module({
  controllers: [AuditController],
  providers: [AuditService],
})
export class AuditModule {}
