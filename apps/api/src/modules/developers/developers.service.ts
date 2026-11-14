import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListingStatus, PlanFrequency, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { planBreakdown, planProblem, type PlanTerms } from './plan-math';
import {
  ComparePlansDto,
  CreateDeveloperDto,
  CreatePlanDto,
  CreateProjectDto,
  UpdateDeveloperDto,
  UpdatePlanDto,
  UpdateProjectDto,
} from './dto/developer.dto';

const num = (d: Prisma.Decimal | number | null | undefined) =>
  d === null || d === undefined ? null : Number(d);
const clean = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null);
const day = (v: string | null | undefined) =>
  v === undefined ? undefined : v ? new Date(`${v.slice(0, 10)}T00:00:00.000Z`) : null;

const PLAN_ORDER = [
  { active: 'desc' as const },
  { years: 'asc' as const },
  { downPaymentPct: 'desc' as const },
];

/**
 * BRK-5 — the brokerage's own directory of the developers it sells for: their
 * contacts and agreed commission, their projects, and the payment plans each
 * project offers. Every query runs in the tenant context (TENANT_OWNED).
 */
@Injectable()
export class DevelopersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q?: string) {
    const term = q?.trim();
    const rows = await this.prisma.brokerDeveloper.findMany({
      where: term
        ? {
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { projects: { some: { name: { contains: term, mode: 'insensitive' } } } },
            ],
          }
        : {},
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      include: {
        projects: {
          orderBy: [{ active: 'desc' }, { name: 'asc' }],
          include: { _count: { select: { plans: true, listings: true } } },
        },
      },
    });
    return rows;
  }

  async get(id: string) {
    const d = await this.prisma.brokerDeveloper.findFirst({
      where: { id },
      include: {
        projects: {
          orderBy: [{ active: 'desc' }, { name: 'asc' }],
          include: {
            plans: { orderBy: PLAN_ORDER },
            listings: {
              where: { status: { in: [ListingStatus.AVAILABLE, ListingStatus.UNDER_OFFER] } },
              select: { id: true, code: true, title: true, price: true, status: true },
              orderBy: { createdAt: 'desc' },
              take: 20,
            },
          },
        },
      },
    });
    if (!d) throw new NotFoundException('المطوّر غير موجود');
    return d;
  }

  async create(dto: CreateDeveloperDto) {
    try {
      return await this.prisma.brokerDeveloper.create({
        data: {
          name: dto.name.trim(),
          contactName: clean(dto.contactName),
          phone: clean(dto.phone),
          email: clean(dto.email),
          website: clean(dto.website),
          defaultCommissionPct: dto.defaultCommissionPct ?? null,
          notes: clean(dto.notes),
        },
      });
    } catch (e) {
      throw this.duplicate(e, 'يوجد مطوّر بنفس الاسم');
    }
  }

  async update(id: string, dto: UpdateDeveloperDto) {
    await this.get(id);
    try {
      await this.prisma.brokerDeveloper.updateMany({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.contactName !== undefined ? { contactName: clean(dto.contactName) } : {}),
          ...(dto.phone !== undefined ? { phone: clean(dto.phone) } : {}),
          ...(dto.email !== undefined ? { email: clean(dto.email) } : {}),
          ...(dto.website !== undefined ? { website: clean(dto.website) } : {}),
          ...(dto.defaultCommissionPct !== undefined
            ? { defaultCommissionPct: dto.defaultCommissionPct }
            : {}),
          ...(dto.notes !== undefined ? { notes: clean(dto.notes) } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        },
      });
    } catch (e) {
      throw this.duplicate(e, 'يوجد مطوّر بنفس الاسم');
    }
    return this.get(id);
  }

  /** A developer with listings filed under its projects is deactivated, not removed. */
  async remove(id: string) {
    await this.get(id);
    const linked = await this.prisma.listing.count({
      where: { developerProject: { developerId: id } },
    });
    if (linked > 0) throw new ConflictException('مرتبط بوحدات معروضة — أوقفه بدل حذفه');
    await this.prisma.brokerDeveloper.deleteMany({ where: { id } });
    return { ok: true };
  }

  // ── Projects ─────────────────────────────────────────────────────────────

  private async project(id: string) {
    const p = await this.prisma.developerProject.findFirst({
      where: { id },
      include: { developer: { select: { id: true, name: true, defaultCommissionPct: true } } },
    });
    if (!p) throw new NotFoundException('المشروع غير موجود');
    return p;
  }

  async createProject(developerId: string, dto: CreateProjectDto) {
    await this.get(developerId);
    try {
      return await this.prisma.developerProject.create({
        data: {
          developerId,
          name: dto.name.trim(),
          city: clean(dto.city),
          district: clean(dto.district),
          commissionPct: dto.commissionPct ?? null,
          deliveryDate: day(dto.deliveryDate) ?? null,
          notes: clean(dto.notes),
        },
      });
    } catch (e) {
      throw this.duplicate(e, 'يوجد مشروع بنفس الاسم لهذا المطوّر');
    }
  }

  async updateProject(id: string, dto: UpdateProjectDto) {
    await this.project(id);
    try {
      await this.prisma.developerProject.updateMany({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.city !== undefined ? { city: clean(dto.city) } : {}),
          ...(dto.district !== undefined ? { district: clean(dto.district) } : {}),
          ...(dto.commissionPct !== undefined ? { commissionPct: dto.commissionPct } : {}),
          ...(dto.deliveryDate !== undefined ? { deliveryDate: day(dto.deliveryDate) } : {}),
          ...(dto.notes !== undefined ? { notes: clean(dto.notes) } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        },
      });
    } catch (e) {
      throw this.duplicate(e, 'يوجد مشروع بنفس الاسم لهذا المطوّر');
    }
    return this.project(id);
  }

  async removeProject(id: string) {
    await this.project(id);
    if ((await this.prisma.listing.count({ where: { developerProjectId: id } })) > 0) {
      throw new ConflictException('مرتبط بوحدات معروضة — أوقفه بدل حذفه');
    }
    await this.prisma.developerProject.deleteMany({ where: { id } });
    return { ok: true };
  }

  /** The projects to pick from when filing a primary listing, with the commission that applies. */
  async projectOptions() {
    const rows = await this.prisma.developerProject.findMany({
      where: { active: true, developer: { active: true } },
      orderBy: [{ developer: { name: 'asc' } }, { name: 'asc' }],
      include: { developer: { select: { id: true, name: true, defaultCommissionPct: true } } },
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      city: p.city,
      district: p.district,
      developer: { id: p.developer.id, name: p.developer.name },
      commissionPct: num(p.commissionPct) ?? num(p.developer.defaultCommissionPct),
    }));
  }

  // ── Plans ────────────────────────────────────────────────────────────────

  private terms(p: {
    downPaymentPct: number;
    years: number;
    frequency?: PlanFrequency;
    deliveryPct?: number;
    cashDiscountPct?: number;
  }): PlanTerms {
    return {
      downPaymentPct: p.downPaymentPct,
      years: p.years,
      frequency: p.frequency ?? PlanFrequency.QUARTERLY,
      deliveryPct: p.deliveryPct ?? 0,
      cashDiscountPct: p.cashDiscountPct ?? 0,
    };
  }

  async createPlan(projectId: string, dto: CreatePlanDto) {
    await this.project(projectId);
    const t = this.terms(dto);
    const problem = planProblem(t);
    if (problem) throw new BadRequestException(problem);
    return this.prisma.developerPlan.create({
      data: { projectId, name: dto.name.trim(), ...t, notes: clean(dto.notes) },
    });
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    const cur = await this.prisma.developerPlan.findFirst({ where: { id } });
    if (!cur) throw new NotFoundException('الخطة غير موجودة');
    const t = this.terms({
      downPaymentPct: dto.downPaymentPct ?? Number(cur.downPaymentPct),
      years: dto.years ?? cur.years,
      frequency: dto.frequency ?? cur.frequency,
      deliveryPct: dto.deliveryPct ?? Number(cur.deliveryPct),
      cashDiscountPct: dto.cashDiscountPct ?? Number(cur.cashDiscountPct),
    });
    const problem = planProblem(t);
    if (problem) throw new BadRequestException(problem);
    await this.prisma.developerPlan.updateMany({
      where: { id },
      data: {
        ...t,
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.notes !== undefined ? { notes: clean(dto.notes) } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
    return this.prisma.developerPlan.findFirst({ where: { id } });
  }

  async removePlan(id: string) {
    const done = await this.prisma.developerPlan.deleteMany({ where: { id } });
    if (done.count === 0) throw new NotFoundException('الخطة غير موجودة');
    return { ok: true };
  }

  /** Every active plan, by developer and project, for the comparison picker. */
  async planOptions() {
    const rows = await this.prisma.developerPlan.findMany({
      where: { active: true, project: { active: true, developer: { active: true } } },
      orderBy: [
        { project: { developer: { name: 'asc' } } },
        { project: { name: 'asc' } },
        { years: 'asc' },
      ],
      include: {
        project: {
          select: { id: true, name: true, developer: { select: { id: true, name: true } } },
        },
      },
    });
    return rows;
  }

  /** The chosen plans on one price, side by side, in the order asked. */
  async compare(dto: ComparePlansDto) {
    const ids = [...new Set(dto.planIds)];
    const plans = await this.prisma.developerPlan.findMany({
      where: { id: { in: ids } },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            deliveryDate: true,
            developer: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (plans.length !== ids.length) throw new NotFoundException('خطة غير موجودة');
    const byId = new Map(plans.map((p) => [p.id, p]));
    return {
      price: dto.price,
      plans: ids.map((id) => {
        const p = byId.get(id)!;
        const terms = this.terms({
          downPaymentPct: Number(p.downPaymentPct),
          years: p.years,
          frequency: p.frequency,
          deliveryPct: Number(p.deliveryPct),
          cashDiscountPct: Number(p.cashDiscountPct),
        });
        return {
          id: p.id,
          name: p.name,
          project: p.project,
          terms,
          breakdown: planBreakdown(dto.price, terms),
        };
      }),
    };
  }

  private duplicate(e: unknown, message: string) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      return new ConflictException(message);
    return e;
  }
}
