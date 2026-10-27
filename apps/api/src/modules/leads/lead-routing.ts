import { LeadFollowUpType, Prisma } from '@prisma/client';
import type { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { roundRobinPool } from '../../common/utils/sales-scope';

/*
 * How leads that arrive on their own (an ad form, the website) are routed:
 * handed to the sales reps in turn, with a first call scheduled. Company
 * settings, set from «استقبال العملاء تلقائيًا».
 */
export const AUTO_ASSIGN_KEY = 'leads.autoAssign';
export const FIRST_CALL_KEY = 'leads.firstCallMinutes';
const CURSOR_KEY = 'leads.roundRobinCursor';

export type AutoAssignMode = 'ROUND_ROBIN' | 'NONE';
export interface RoutingSettings {
  /** ROUND_ROBIN: to each active rep in turn; NONE: left for a manager to route. */
  autoAssign: AutoAssignMode;
  /** Minutes until the first call is due; 0 schedules none. */
  firstCallMinutes: number;
}
export const ROUTING_DEFAULTS: RoutingSettings = { autoAssign: 'ROUND_ROBIN', firstCallMinutes: 60 };

export async function routingSettings(prisma: PrismaService): Promise<RoutingSettings> {
  const companyId = getRequiredCompanyId();
  const rows = await prisma.setting.findMany({
    where: { companyId, key: { in: [AUTO_ASSIGN_KEY, FIRST_CALL_KEY] } },
    select: { key: true, value: true },
  });
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  const mode = get(AUTO_ASSIGN_KEY);
  const minutes = get(FIRST_CALL_KEY);
  return {
    autoAssign: mode === 'NONE' || mode === 'ROUND_ROBIN' ? mode : ROUTING_DEFAULTS.autoAssign,
    firstCallMinutes: typeof minutes === 'number' && minutes >= 0 ? Math.floor(minutes) : ROUTING_DEFAULTS.firstCallMinutes,
  };
}

export async function saveRoutingSettings(prisma: PrismaService, s: Partial<RoutingSettings>): Promise<RoutingSettings> {
  const companyId = getRequiredCompanyId();
  const put = (key: string, value: Prisma.InputJsonValue) =>
    prisma.setting.upsert({ where: { companyId_key: { companyId, key } }, create: { companyId, key, value }, update: { value } });
  if (s.autoAssign !== undefined) await put(AUTO_ASSIGN_KEY, s.autoAssign);
  if (s.firstCallMinutes !== undefined) await put(FIRST_CALL_KEY, s.firstCallMinutes);
  return routingSettings(prisma);
}

/**
 * The next rep in turn, after the one the last lead went to; null when the
 * company has no active rep. Two leads arriving at the same instant may go
 * to the same rep — the turn then simply moves on.
 */
export async function nextRoundRobinSales(prisma: PrismaService): Promise<string | null> {
  const companyId = getRequiredCompanyId();
  const pool = await roundRobinPool(prisma);
  if (pool.length === 0) return null;
  const cursor = await prisma.setting.findFirst({ where: { companyId, key: CURSOR_KEY }, select: { value: true } });
  const last = typeof cursor?.value === 'string' ? pool.indexOf(cursor.value) : -1;
  const next = pool[(last + 1) % pool.length]!;
  await prisma.setting.upsert({
    where: { companyId_key: { companyId, key: CURSOR_KEY } },
    create: { companyId, key: CURSOR_KEY, value: next },
    update: { value: next },
  });
  return next;
}

/** The first call on a lead that just arrived, `minutes` from now (none at 0). */
export function firstCall(minutes: number, note: string) {
  if (minutes <= 0) return null;
  return {
    nextActionAt: new Date(Date.now() + minutes * 60_000),
    nextActionType: LeadFollowUpType.CALL,
    nextActionNote: note,
  };
}

/**
 * Route a lead that just arrived on its own (the website): to the next rep in
 * turn when the company hands leads out that way, with the first call
 * scheduled. Returns who it went to (null: left for a manager).
 */
export async function routeArrivedLead(prisma: PrismaService, leadId: string): Promise<string | null> {
  const companyId = getRequiredCompanyId();
  const routing = await routingSettings(prisma);
  const assignee = routing.autoAssign === 'ROUND_ROBIN' ? await nextRoundRobinSales(prisma) : null;
  const call = firstCall(routing.firstCallMinutes, 'عميل جديد من الموقع — أول اتصال');
  if (assignee || call) {
    await prisma.lead.updateMany({
      where: { id: leadId, companyId, assignedSalesId: null },
      data: { ...(assignee ? { assignedSalesId: assignee } : {}), ...(call ?? {}) },
    });
    if (assignee) {
      await prisma.leadActivity.create({ data: { leadId, type: 'assigned', payload: { salesId: assignee, by: 'round_robin' } } });
    }
  }
  return assignee;
}
