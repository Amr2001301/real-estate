import { Injectable, Logger, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CronLockService } from '../../common/cron/cron-lock.service';
import { runInCompany, runTenantContext } from '../../common/tenant/tenant-context';
import { ACCESSIBLE_COMPANY_WHERE } from '../../common/tenant/company-access';
import { reportFailure } from '../../common/observability/report-failure';
import { NotificationsService } from '../notifications/notifications.module';
import { LIVE_CONTRACT_WHERE } from '../installments/live-contract';
import { UnitValueService } from './unit-value.service';
import { UNIT_VALUE_KEYS, resolveUnitValueSettings, shouldNotifyRise } from './unit-value';

export const UNIT_VALUE_RISE_TEMPLATE = 'unit_value_rise_customer';

/**
 * On in production unless UNIT_VALUE_ALERTS_ENABLED=false; elsewhere (dev,
 * tests) only when set to true, so a cron never fires mid-test.
 */
function isEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const flag = (env.UNIT_VALUE_ALERTS_ENABLED ?? '').toLowerCase();
  if (flag) return flag === 'true';
  return env.NODE_ENV === 'production';
}

/**
 * «ارتفعت قيمة وحدتك»: once a day, each owner whose unit is now worth more
 * than they paid — by the same figures «قيمة وحدتك» shows them — is told so.
 * Only while the company shows unit values and has not turned the notice
 * off; per unit at most once in 30 days, and only for a rise of at least 1%
 * over the value in the last notice (the price paid before any). A fall is
 * never sent.
 */
@Injectable()
export class UnitValueRiseCron {
  private readonly logger = new Logger(UnitValueRiseCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly values: UnitValueService,
    @Optional() private readonly moduleRef?: ModuleRef,
    @Optional() private readonly lock?: CronLockService,
  ) {}

  /**
   * Looked up when sending (as ProjectsService does), so UnitsModule does not
   * import the notifications module and its dependencies.
   */
  private notifications(): NotificationsService | null {
    try {
      return this.moduleRef?.get(NotificationsService, { strict: false }) ?? null;
    } catch {
      return null;
    }
  }

  @Cron(process.env.UNIT_VALUE_RISE_CRON || '0 10 * * *', { name: 'unit-value-rise' })
  async daily(): Promise<void> {
    if (!isEnabled()) return;
    await runTenantContext({ companyId: null, bypass: true, isPublic: false }, async () => {
      try {
        const run = () => this.run();
        if (this.lock) await this.lock.withLock('unit-value-rise', 30 * 60_000, run);
        else await run();
      } catch (err) {
        reportFailure(this.logger, 'cron', '[unit-value-rise] failed', err, 'error');
      }
    });
  }

  /** The companies showing unit values to their customers (runs in bypass). */
  private async companies(): Promise<string[]> {
    const rows = await this.prisma.setting.findMany({
      where: { key: UNIT_VALUE_KEYS.enabled, company: ACCESSIBLE_COMPANY_WHERE },
      select: { companyId: true, value: true },
    });
    return rows.filter((r) => r.value === true).map((r) => r.companyId);
  }

  /** Sends the notices that are due; returns how many were sent. */
  async run(now = new Date(), onlyCompanyId?: string): Promise<{ sent: number }> {
    let sent = 0;
    const companies = onlyCompanyId ? [onlyCompanyId] : await this.companies();
    for (const companyId of companies) {
      try {
        sent += await runInCompany(companyId, () => this.runCompany(companyId, now));
      } catch (err) {
        reportFailure(this.logger, 'cron', `[unit-value-rise] company ${companyId}`, err);
      }
    }
    if (sent) this.logger.log(`Unit value rose: ${sent} owner notice(s) sent`);
    return { sent };
  }

  private async runCompany(companyId: string, now: Date): Promise<number> {
    const settings = resolveUnitValueSettings(
      await this.prisma.setting.findMany({
        where: { companyId, key: { in: Object.values(UNIT_VALUE_KEYS) } },
        select: { key: true, value: true },
      }),
    );
    if (!settings.enabled || !settings.notifyRise) return 0;
    const owners = await this.prisma.contract.findMany({
      where: { ...LIVE_CONTRACT_WHERE, companyId, signedAt: { not: null } },
      select: { customerId: true },
      distinct: ['customerId'],
    });
    const notifications = this.notifications();
    if (!notifications) return 0;
    let sent = 0;
    for (const { customerId } of owners) {
      const { items } = await this.values.forCustomer(customerId);
      for (const it of items) {
        const currentValue = Number(it.currentValue);
        const last = await this.prisma.notification.findFirst({
          where: {
            companyId,
            userId: customerId,
            templateCode: UNIT_VALUE_RISE_TEMPLATE,
            payload: { path: ['contractId'], equals: it.contractId },
          },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true, payload: true },
        });
        const lastValue = Number((last?.payload as { amount?: unknown } | null)?.amount);
        const told = last ? { value: Number.isFinite(lastValue) ? lastValue : 0, at: last.createdAt } : null;
        if (!shouldNotifyRise({ purchasePrice: Number(it.purchasePrice), currentValue }, told, now)) continue;
        const name = it.projectName as { ar?: string; en?: string } | string | null;
        await notifications.sendToUser(customerId, UNIT_VALUE_RISE_TEMPLATE, {
          // Opens «عقاري», where the card is; contractId keys the 30-day rule.
          entityType: 'unit_value',
          contractId: it.contractId,
          unitCode: it.unitCode,
          projectName: typeof name === 'string' ? name : name?.ar || name?.en || '',
          // Shown in the company's currency; also the value the next notice compares with.
          amount: it.currentValue,
          gainPct: String(it.gainPct),
        });
        sent += 1;
      }
    }
    return sent;
  }
}
