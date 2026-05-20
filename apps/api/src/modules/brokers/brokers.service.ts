import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, BrokerStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginate, takeSkip } from '../../common/utils/pagination';
import {
  CreateBrokerDto,
  UpdateBrokerDto,
  UpdateBrokerStatusDto,
} from './dto/broker.dto';

const COUNTS_SELECT = {
  _count: {
    select: {
      brokerUsers: true,
      projectAccess: true,
      unitAccess: true,
    },
  },
} as const;

@Injectable()
export class BrokersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBrokerDto) {
    const code = dto.code
      ? await this.ensureCodeAvailable(dto.code)
      : await this.generateUniqueCode(dto.companyName);

    if (dto.taxId) await this.ensureTaxIdAvailable(dto.taxId);

    return this.prisma.broker.create({
      data: {
        companyName: dto.companyName,
        commercialName: dto.commercialName ?? null,
        code,
        logoUrl: dto.logoUrl ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        address: dto.address ?? null,
        city: dto.city ?? null,
        taxId: dto.taxId ?? null,
        commercialRegistration: dto.commercialRegistration ?? null,
        bankName: dto.bankName ?? null,
        bankAccountName: dto.bankAccountName ?? null,
        bankIban: dto.bankIban ?? null,
        defaultCommissionPct:
          dto.defaultCommissionPct !== undefined
            ? new Prisma.Decimal(dto.defaultCommissionPct)
            : new Prisma.Decimal(0),
        commissionModel: dto.commissionModel ?? 'PERCENT_OF_SALE',
        contractStartAt: dto.contractStartAt ? new Date(dto.contractStartAt) : null,
        contractEndAt: dto.contractEndAt ? new Date(dto.contractEndAt) : null,
        contractPdfUrl: dto.contractPdfUrl ?? null,
        notes: dto.notes ?? null,
      },
      include: COUNTS_SELECT,
    });
  }

  async findAll(params: {
    status?: BrokerStatus;
    city?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const trimmed = params.q?.trim();
    const where: Prisma.BrokerWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.city ? { city: { equals: params.city, mode: 'insensitive' } } : {}),
      ...(trimmed
        ? {
            OR: [
              { companyName: { contains: trimmed, mode: 'insensitive' } },
              { commercialName: { contains: trimmed, mode: 'insensitive' } },
              { code: { contains: trimmed.toUpperCase() } },
              { email: { contains: trimmed, mode: 'insensitive' } },
              { phone: { contains: trimmed } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.broker.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...takeSkip({ page, pageSize }),
        include: COUNTS_SELECT,
      }),
      this.prisma.broker.count({ where }),
    ]);
    return paginate(data, total, { page, pageSize });
  }

  async findOne(id: string) {
    const broker = await this.prisma.broker.findUnique({
      where: { id },
      include: COUNTS_SELECT,
    });
    if (!broker) throw new NotFoundException('Broker not found');
    return broker;
  }

  async update(id: string, dto: UpdateBrokerDto) {
    const existing = await this.assertExists(id);

    if (dto.code !== undefined && dto.code !== existing.code) {
      await this.ensureCodeAvailable(dto.code);
    }
    if (dto.taxId !== undefined && dto.taxId !== existing.taxId) {
      if (dto.taxId) await this.ensureTaxIdAvailable(dto.taxId);
    }

    const data: Prisma.BrokerUpdateInput = {};
    if (dto.companyName !== undefined) data.companyName = dto.companyName;
    if (dto.commercialName !== undefined) data.commercialName = dto.commercialName;
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.logoUrl !== undefined) data.logoUrl = dto.logoUrl;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.taxId !== undefined) data.taxId = dto.taxId;
    if (dto.commercialRegistration !== undefined) {
      data.commercialRegistration = dto.commercialRegistration;
    }
    if (dto.bankName !== undefined) data.bankName = dto.bankName;
    if (dto.bankAccountName !== undefined) data.bankAccountName = dto.bankAccountName;
    if (dto.bankIban !== undefined) data.bankIban = dto.bankIban;
    if (dto.defaultCommissionPct !== undefined) {
      data.defaultCommissionPct = new Prisma.Decimal(dto.defaultCommissionPct);
    }
    if (dto.commissionModel !== undefined) data.commissionModel = dto.commissionModel;
    if (dto.contractStartAt !== undefined) {
      data.contractStartAt = dto.contractStartAt ? new Date(dto.contractStartAt) : null;
    }
    if (dto.contractEndAt !== undefined) {
      data.contractEndAt = dto.contractEndAt ? new Date(dto.contractEndAt) : null;
    }
    if (dto.contractPdfUrl !== undefined) data.contractPdfUrl = dto.contractPdfUrl;
    if (dto.notes !== undefined) data.notes = dto.notes;

    return this.prisma.broker.update({
      where: { id },
      data,
      include: COUNTS_SELECT,
    });
  }

  async updateStatus(id: string, dto: UpdateBrokerStatusDto) {
    return this.applyStatus(id, dto.status, dto.reason);
  }

  /** Suspend a firm. Dedicated route so it carries the brokers:suspend code. */
  async suspend(id: string, reason?: string) {
    return this.applyStatus(id, BrokerStatus.SUSPENDED, reason);
  }

  /** Terminate a firm. Dedicated route so it carries the brokers:terminate code. */
  async terminate(id: string, reason?: string) {
    return this.applyStatus(id, BrokerStatus.TERMINATED, reason);
  }

  /**
   * Shared status-change logic. All status transitions (the generic
   * reactivate/pending route plus the dedicated suspend/terminate routes)
   * funnel through here so business behavior and response shape stay
   * identical regardless of entry point.
   */
  private async applyStatus(
    id: string,
    status: BrokerStatus,
    reason?: string,
  ) {
    const existing = await this.assertExists(id);

    // Append the reason to notes for auditability (the global AuditInterceptor
    // also captures the request body, so this is just a soft trail.)
    const data: Prisma.BrokerUpdateInput = { status };
    if (reason && reason.trim().length > 0) {
      const stamp = new Date().toISOString();
      const line = `[${stamp}] ${existing.status} → ${status}: ${reason.trim()}`;
      data.notes = existing.notes ? `${existing.notes}\n${line}` : line;
    }

    return this.prisma.broker.update({
      where: { id },
      data,
      include: COUNTS_SELECT,
    });
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private async assertExists(id: string) {
    const broker = await this.prisma.broker.findUnique({ where: { id } });
    if (!broker) throw new NotFoundException('Broker not found');
    return broker;
  }

  private async ensureCodeAvailable(code: string) {
    const exists = await this.prisma.broker.findUnique({
      where: { code },
      select: { id: true },
    });
    if (exists) throw new ConflictException(`Broker code "${code}" is already in use`);
    return code;
  }

  private async ensureTaxIdAvailable(taxId: string) {
    const exists = await this.prisma.broker.findUnique({
      where: { taxId },
      select: { id: true },
    });
    if (exists) throw new ConflictException(`Broker taxId "${taxId}" is already in use`);
    return taxId;
  }

  // Generate a safe URL-friendly code from companyName, ensuring uniqueness.
  // Falls back to "BROKER" if the name has no ASCII letters/digits (e.g. Arabic only).
  private async generateUniqueCode(companyName: string): Promise<string> {
    const ascii = companyName.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
    const base = (ascii.toUpperCase() || 'BROKER').slice(0, 16);

    for (let i = 0; i < 1000; i++) {
      const candidate = i === 0 ? base : `${base}-${i.toString().padStart(3, '0')}`;
      const exists = await this.prisma.broker.findUnique({
        where: { code: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    }
    throw new ConflictException('Could not generate a unique broker code');
  }
}
