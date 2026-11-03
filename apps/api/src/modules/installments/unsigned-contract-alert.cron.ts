import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { ContractStatus, InstallmentStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CronLockService } from '../../common/cron/cron-lock.service';
import { runInCompany, runTenantContext } from '../../common/tenant/tenant-context';
import { ACCESSIBLE_COMPANY_WHERE } from '../../common/tenant/company-access';
import { reportFailure } from '../../common/observability/report-failure';
import { NotificationsService } from '../notifications/notifications.module';
import { SURCHARGE_PAYMENT_TYPES } from './live-contract';

export const UNSIGNED_CONTRACT_DUE_TEMPLATE = 'unsigned_contract_due';

/** Once alerted, a contract still unsigned is alerted again after this long. */
export const UNSIGNED_ALERT_EVERY_MS = 7 * 24 * 60 * 60_000;

/**
 * On in production unless UNSIGNED_CONTRACT_ALERTS_ENABLED=false; elsewhere
 * (dev, tests) only when set to true, so a cron never fires mid-test.
 */
function isEnabled(config: ConfigService): boolean {
  const flag = (config.get<string>('UNSIGNED_CONTRACT_ALERTS_ENABLED') ?? '').toLowerCase();
  if (flag) return flag === 'true';
  return config.get<string>('NODE_ENV') === 'production';
}

interface DueContract {
  id: string;
  companyId: string;
  contractNumber: string | null;
  unitCode: string;
  salesId: string | null;
  managerId: string | null;
  count: number;
  total: number;
  firstDue: Date;
}

/**
 * ST2 — an unsigned contract with payments already due. Such a contract is
 * not chased (no reminder to the customer, no late fee) until it is signed,
 * so nothing told anyone it was waiting. Staff are told instead — never the
 * customer (owner, 2026-11-03): the sales person on the deal, their sales
 * manager, and the company's admins. Once when a payment first falls due,
 * then once a week while the contract stays unsigned.
 */
@Injectable()
export class UnsignedContractAlertCron {
  private readonly logger = new Logger(UnsignedContractAlertCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    @Optional() private readonly lock?: CronLockService,
  ) {}

  @Cron(process.env.UNSIGNED_CONTRACT_ALERT_CRON || '0 7 * * *', {
    name: 'unsigned-contract-alerts',
  })
  async daily(): Promise<void> {
    if (!isEnabled(this.config)) return;
    await runTenantContext({ companyId: null, bypass: true, isPublic: false }, async () => {
      try {
        const run = () => this.run();
        if (this.lock) await this.lock.withLock('unsigned-contract-alerts', 30 * 60_000, run);
        else await run();
      } catch (err) {
        reportFailure(this.logger, 'cron', '[unsigned-contract-alerts] failed', err, 'error');
      }
    });
  }

  /** The unsigned contracts with a payment due by `now`, one entry each (runs in bypass). */
  async dueContracts(now: Date): Promise<DueContract[]> {
    const rows = await this.prisma.installment.findMany({
      where: {
        status: { in: [InstallmentStatus.PENDING, InstallmentStatus.OVERDUE] },
        type: { notIn: SURCHARGE_PAYMENT_TYPES },
        dueDate: { lte: now },
        plan: {
          cancelledAt: null,
          contract: {
            status: ContractStatus.UNSIGNED,
            deletedAt: null,
            company: ACCESSIBLE_COMPANY_WHERE,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      select: {
        amount: true,
        dueDate: true,
        plan: {
          select: {
            contract: {
              select: {
                id: true,
                companyId: true,
                contractNumber: true,
                unit: { select: { code: true } },
                reservation: { select: { salesId: true, sales: { select: { managerId: true } } } },
              },
            },
          },
        },
      },
    });
    const byContract = new Map<string, DueContract>();
    for (const r of rows) {
      const c = r.plan.contract;
      if (!c.companyId) continue;
      const entry =
        byContract.get(c.id) ??
        byContract
          .set(c.id, {
            id: c.id,
            companyId: c.companyId,
            contractNumber: c.contractNumber,
            unitCode: c.unit.code,
            salesId: c.reservation?.salesId ?? null,
            managerId: c.reservation?.sales?.managerId ?? null,
            count: 0,
            total: 0,
            firstDue: r.dueDate,
          })
          .get(c.id)!;
      entry.count += 1;
      entry.total += Number(r.amount);
    }
    return [...byContract.values()];
  }

  /** Sends the alerts that are due; returns how many contracts were alerted. */
  async run(now = new Date()): Promise<{ alerted: number; skipped: number }> {
    let alerted = 0;
    let skipped = 0;
    for (const c of await this.dueContracts(now)) {
      try {
        const sent = await runInCompany(c.companyId, async () => {
          const last = await this.prisma.notification.findFirst({
            where: {
              companyId: c.companyId,
              templateCode: UNSIGNED_CONTRACT_DUE_TEMPLATE,
              payload: { path: ['contractId'], equals: c.id },
            },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          });
          if (last && now.getTime() - last.createdAt.getTime() < UNSIGNED_ALERT_EVERY_MS)
            return false;
          await this.notifications.sendToUsersAndRoles(
            [c.salesId, c.managerId],
            [UserRole.ADMIN],
            UNSIGNED_CONTRACT_DUE_TEMPLATE,
            {
              entityType: 'contract',
              entityId: c.id,
              contractId: c.id,
              contractNumber: c.contractNumber ?? '',
              unitCode: c.unitCode,
              count: c.count,
              total: Math.round(c.total).toLocaleString('en-US'),
              firstDue: c.firstDue.toISOString().slice(0, 10),
            },
          );
          return true;
        });
        if (sent) alerted += 1;
        else skipped += 1;
      } catch (err) {
        reportFailure(this.logger, 'cron', `[unsigned-contract-alerts] contract ${c.id}`, err);
      }
    }
    if (alerted)
      this.logger.log(
        `Unsigned contracts with payments due: ${alerted} alerted, ${skipped} not yet due again`,
      );
    return { alerted, skipped };
  }
}
