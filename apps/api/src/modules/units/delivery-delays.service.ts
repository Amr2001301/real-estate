import { Injectable, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { dateOnlyString } from '../../common/time/date-only';
import { LIVE_CONTRACT_WHERE } from '../installments/live-contract';
import { NotificationsService } from '../notifications/notifications.module';

interface Promised {
  contractId: string;
  contractNumber: string | null;
  customerId: string;
  unitCode: string;
  /** What the contract promises (YYYY-MM-DD). */
  contractDate: string;
  /** The unit's date now: its own, or its phase's. */
  expected: string | null;
}

/**
 * A signed contract keeps the handover date it promised (F10). When a
 * phase's or a unit's date moves past it, the customer is told — once per
 * slip: only when the expected date is now later than both the contract's
 * and what it was before the change.
 */
@Injectable()
export class DeliveryDelaysService {
  constructor(
    private readonly prisma: PrismaService,
    // The notifications service is looked up when a notice is sent, not
    // injected: importing its module here would pull the auth stack into the
    // units and phases modules.
    @Optional() private readonly moduleRef?: ModuleRef,
  ) {}

  private notifications(): NotificationsService | null {
    try {
      return this.moduleRef?.get(NotificationsService, { strict: false }) ?? null;
    } catch {
      return null;
    }
  }

  /** The live signed contracts with a promised date, on the units given. */
  async snapshot(units: Prisma.UnitWhereInput): Promise<Map<string, Promised>> {
    const rows = await this.prisma.contract.findMany({
      where: {
        ...LIVE_CONTRACT_WHERE,
        companyId: getRequiredCompanyId(),
        signedAt: { not: null },
        deliveryDate: { not: null },
        unit: units,
      },
      select: {
        id: true,
        contractNumber: true,
        customerId: true,
        deliveryDate: true,
        unit: { select: { code: true, deliveryDate: true, building: { select: { phase: { select: { deliveryDate: true } } } } } },
      },
    });
    return new Map(
      rows.map((c) => [
        c.id,
        {
          contractId: c.id,
          contractNumber: c.contractNumber,
          customerId: c.customerId,
          unitCode: c.unit.code,
          contractDate: dateOnlyString(c.deliveryDate)!,
          expected: dateOnlyString(c.unit.deliveryDate ?? c.unit.building.phase.deliveryDate),
        },
      ]),
    );
  }

  /** After a date change: tell each customer whose handover now slips past the contract's. */
  async notifySlips(units: Prisma.UnitWhereInput, before: Map<string, Promised>): Promise<number> {
    if (!before.size) return 0;
    const after = await this.snapshot(units);
    let sent = 0;
    for (const [id, now] of after) {
      const was = before.get(id);
      if (!now.expected || now.expected <= now.contractDate) continue;
      if (was?.expected && was.expected >= now.expected) continue;
      await this.notifications()?.sendToUser(now.customerId, 'delivery_delayed_customer', {
        contractId: now.contractId,
        contractNumber: now.contractNumber ?? '',
        unitCode: now.unitCode,
        contractDate: now.contractDate,
        expectedDate: now.expected,
      });
      sent++;
    }
    return sent;
  }
}
