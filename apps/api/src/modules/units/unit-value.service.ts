import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PriceRateSource, Prisma, UnitStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { commissionBasis } from '../../common/finance/commission-basis';
import { LIVE_CONTRACT_WHERE } from '../installments/live-contract';
import {
  UNIT_VALUE_KEYS,
  averagePerMeter,
  currentRate,
  isShown,
  resolveUnitValueSettings,
  unitValue,
  valueHistory,
  type PricedUnit,
} from './unit-value';

const num = (d: Prisma.Decimal | number | null | undefined) => (d === null || d === undefined ? 0 : Number(d));
const money = (n: number) => n.toFixed(2);

/**
 * «قيمة وحدتك»: records each project's price per meter as prices change,
 * keeps the company's own figure for a type that sold out, and values an
 * owner's unit against what they paid.
 */
@Injectable()
export class UnitValueService {
  private readonly logger = new Logger(UnitValueService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** The units for sale in a project, with what values them. */
  private forSale(companyId: string, projectId: string): Promise<PricedUnit[]> {
    return this.prisma.unit
      .findMany({
        where: { companyId, status: UnitStatus.AVAILABLE, area: { gt: 0 }, building: { phase: { projectId } } },
        select: { price: true, area: true, type: true, usage: true, modelId: true },
      })
      .then((rows) => rows.map((u) => ({ price: num(u.price), area: Number(u.area), type: u.type, usage: u.usage, modelId: u.modelId })));
  }

  /** The company's latest own figure per type (null = the whole project). */
  private async manualRates(companyId: string, projectId: string) {
    const rows = await this.prisma.unitPriceRate.findMany({
      where: { companyId, projectId, source: PriceRateSource.MANUAL },
      orderBy: { recordedAt: 'desc' },
      distinct: ['unitType'],
      select: { unitType: true, pricePerMeter: true, recordedAt: true },
    });
    return rows;
  }

  /**
   * Records today's average price per meter of the units for sale, per type
   * and for the project, where it moved since the last record — the history
   * an owner's chart draws. Called after prices change; never fails the
   * change that called it.
   */
  async recordMarketRates(projectIds: Iterable<string>): Promise<void> {
    try {
      const companyId = getRequiredCompanyId();
      for (const projectId of new Set(projectIds)) {
        const units = await this.forSale(companyId, projectId);
        const now = new Map<string | null, number>();
        const all = averagePerMeter(units);
        if (all !== null) now.set(null, all);
        for (const type of new Set(units.map((u) => u.type))) {
          const r = averagePerMeter(units.filter((u) => u.type === type));
          if (r !== null) now.set(type, r);
        }
        if (now.size === 0) continue;
        const last = await this.prisma.unitPriceRate.findMany({
          where: { companyId, projectId, source: PriceRateSource.MARKET },
          orderBy: { recordedAt: 'desc' },
          distinct: ['unitType'],
          select: { unitType: true, pricePerMeter: true },
        });
        const lastBy = new Map(last.map((r) => [r.unitType, num(r.pricePerMeter)]));
        const moved = [...now].filter(([type, rate]) => lastBy.get(type) !== rate);
        if (moved.length === 0) continue;
        await this.prisma.unitPriceRate.createMany({
          data: moved.map(([unitType, rate]) => ({
            companyId,
            projectId,
            unitType,
            pricePerMeter: new Prisma.Decimal(rate),
            source: PriceRateSource.MARKET,
          })),
        });
      }
    } catch (e) {
      this.logger.warn(`price-per-meter record skipped: ${(e as Error).message}`);
    }
  }

  /** The project of a unit, for [recordMarketRates]. */
  async projectOfUnit(unitId: string): Promise<string | null> {
    const u = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { building: { select: { phase: { select: { projectId: true } } } } },
    });
    return u?.building?.phase?.projectId ?? null;
  }

  // ── Dashboard: a project's prices per meter ─────────────────────────────────

  /**
   * Per unit type in the project: units for sale and in all, today's average
   * price per meter of those for sale, and the company's own figure (used
   * once a type sells out).
   */
  async projectRates(projectId: string) {
    const companyId = getRequiredCompanyId();
    const project = await this.prisma.project.findFirst({ where: { id: projectId, companyId }, select: { id: true } });
    if (!project) throw new NotFoundException('Project not found');
    const [units, manual] = await Promise.all([
      this.prisma.unit.findMany({
        where: { companyId, building: { phase: { projectId } } },
        select: { type: true, status: true, price: true, area: true },
      }),
      this.manualRates(companyId, projectId),
    ]);
    const manualBy = new Map(manual.map((m) => [m.unitType, m]));
    const row = (unitType: string | null) => {
      const ofType = units.filter((u) => unitType === null || u.type === unitType);
      const forSale = ofType.filter((u) => u.status === UnitStatus.AVAILABLE).map((u) => ({ price: num(u.price), area: Number(u.area) }));
      const m = manualBy.get(unitType);
      const market = averagePerMeter(forSale);
      return {
        unitType,
        units: ofType.length,
        forSale: forSale.length,
        marketPricePerMeter: market === null ? null : money(market),
        manual: m ? { pricePerMeter: money(num(m.pricePerMeter)), recordedAt: m.recordedAt.toISOString() } : null,
      };
    };
    return {
      project: row(null),
      types: [...new Set(units.map((u) => u.type))].sort().map(row),
    };
  }

  /** Sets the company's own price per meter for a type (or the project). */
  async setManualRate(projectId: string, unitType: string | null, pricePerMeter: number, userId: string | undefined) {
    const companyId = getRequiredCompanyId();
    const project = await this.prisma.project.findFirst({ where: { id: projectId, companyId }, select: { id: true } });
    if (!project) throw new NotFoundException('Project not found');
    if (unitType !== null) {
      // A type the project has units of, spelled as stored.
      const unit = await this.prisma.unit.findFirst({
        where: { companyId, type: { equals: unitType, mode: 'insensitive' }, building: { phase: { projectId } } },
        select: { type: true },
      });
      if (!unit) throw new NotFoundException('No units of this type in the project');
      unitType = unit.type;
    }
    await this.prisma.unitPriceRate.create({
      data: {
        companyId,
        projectId,
        unitType,
        pricePerMeter: new Prisma.Decimal(pricePerMeter),
        source: PriceRateSource.MANUAL,
        createdById: userId ?? null,
      },
    });
    return this.projectRates(projectId);
  }

  // ── The owner: «قيمة وحدتك» ─────────────────────────────────────────────────

  /**
   * The customer's signed units valued today. Nothing while the company has
   * the feature off; a unit with no price to compare, or (unless the company
   * shows falls too) whose value did not rise, is left out.
   */
  async forCustomer(customerId: string) {
    const companyId = getRequiredCompanyId();
    const settings = resolveUnitValueSettings(
      await this.prisma.setting.findMany({
        where: { companyId, key: { in: Object.values(UNIT_VALUE_KEYS) } },
        select: { key: true, value: true },
      }),
    );
    if (!settings.enabled) return { enabled: false, items: [] };

    const contracts = await this.prisma.contract.findMany({
      where: { ...LIVE_CONTRACT_WHERE, companyId, customerId, signedAt: { not: null } },
      orderBy: { signedAt: 'asc' },
      select: {
        id: true,
        signedAt: true,
        totalAmount: true,
        markupWaived: true,
        reservation: { select: { snapshotFinancedAmount: true, snapshotRemainingAmount: true } },
        unit: {
          select: {
            id: true,
            code: true,
            type: true,
            usage: true,
            area: true,
            modelId: true,
            building: { select: { phase: { select: { project: { select: { id: true, name: true } } } } } },
          },
        },
      },
    });

    const today = new Date();
    const perProject = new Map<string, Promise<{ forSale: PricedUnit[]; manual: Map<string | null, number> }>>();
    const projectData = (projectId: string) => {
      if (!perProject.has(projectId)) {
        perProject.set(
          projectId,
          Promise.all([this.forSale(companyId, projectId), this.manualRates(companyId, projectId)]).then(([forSale, manual]) => ({
            forSale,
            manual: new Map(manual.map((m) => [m.unitType, num(m.pricePerMeter)])),
          })),
        );
      }
      return perProject.get(projectId)!;
    };

    const items = [];
    for (const c of contracts) {
      const project = c.unit.building?.phase?.project;
      const area = Number(c.unit.area);
      if (!project || !(area > 0) || !c.signedAt) continue;
      const purchase = Number(commissionBasis(c.totalAmount, c.reservation ?? undefined, c.markupWaived));
      if (!(purchase > 0)) continue;
      const { forSale, manual } = await projectData(project.id);
      const rate = currentRate({ type: c.unit.type, usage: c.unit.usage, modelId: c.unit.modelId }, forSale, manual);
      if (!rate) continue;
      const { currentValue, gain, gainPct } = unitValue(purchase, area, rate.pricePerMeter);
      if (!isShown(gain, settings.showDecrease)) continue;

      // The chart follows the type's rates (the project's when valued on it).
      const recorded = await this.prisma.unitPriceRate.findMany({
        where: {
          companyId,
          projectId: project.id,
          unitType: rate.basis === 'PROJECT' || rate.basis === 'USAGE' ? null : c.unit.type,
          recordedAt: { gt: c.signedAt },
        },
        orderBy: { recordedAt: 'asc' },
        select: { recordedAt: true, pricePerMeter: true },
      });
      const history = valueHistory(
        c.signedAt,
        purchase / area,
        recorded.map((r) => ({ recordedAt: r.recordedAt, pricePerMeter: num(r.pricePerMeter) })),
        { at: today, pricePerMeter: rate.pricePerMeter },
      );

      items.push({
        contractId: c.id,
        unitId: c.unit.id,
        unitCode: c.unit.code,
        unitType: c.unit.type,
        projectId: project.id,
        projectName: project.name,
        area,
        purchasedAt: c.signedAt.toISOString(),
        purchasePrice: money(purchase),
        purchasePricePerMeter: money(purchase / area),
        currentPricePerMeter: money(rate.pricePerMeter),
        currentValue: money(currentValue),
        gain: money(gain),
        gainPct,
        basis: rate.basis,
        source: rate.source,
        history,
      });
    }
    return { enabled: true, items };
  }
}
