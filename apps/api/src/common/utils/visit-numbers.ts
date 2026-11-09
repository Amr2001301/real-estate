import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from '../tenant/tenant-context';

type Db = PrismaService | Prisma.TransactionClient;

/** Highest sequence a company has used under `prefix`, or 0. */
function highestSequence(values: Array<string | null>, prefix: string): number {
  let max = 0;
  for (const value of values) {
    if (!value || !value.startsWith(prefix)) continue;
    const seq = parseInt(value.slice(prefix.length), 10);
    if (!Number.isNaN(seq) && seq > max) max = seq;
  }
  return max;
}

/**
 * Next visit-request number of the current company: `VR-<year>-<seq>`, the
 * highest of the year + 1, zero-padded to 4. Numbers are unique per company
 * (`@@unique([companyId, requestNumber])`); two writers can compute the same
 * one, so callers retry on a unique conflict.
 */
export async function nextVisitRequestNumber(db: Db, now = new Date()): Promise<string> {
  const companyId = getTenantContext()?.companyId;
  const prefix = `VR-${now.getFullYear()}-`;
  const rows = await db.visitRequest.findMany({
    where: { ...(companyId ? { companyId } : {}), requestNumber: { startsWith: prefix } },
    select: { requestNumber: true },
  });
  return `${prefix}${String(highestSequence(rows.map((r) => r.requestNumber), prefix) + 1).padStart(4, '0')}`;
}

/** Next appointment number of the current company: `VA-<year>-<seq>`, same rules. */
export async function nextVisitAppointmentNumber(db: Db, now = new Date()): Promise<string> {
  const companyId = getTenantContext()?.companyId;
  const prefix = `VA-${now.getFullYear()}-`;
  const rows = await db.visitAppointment.findMany({
    where: { ...(companyId ? { companyId } : {}), visitNumber: { startsWith: prefix } },
    select: { visitNumber: true },
  });
  return `${prefix}${String(highestSequence(rows.map((r) => r.visitNumber), prefix) + 1).padStart(4, '0')}`;
}

/** Retries `fn` (which must compute its numbers inside) when a number was taken meanwhile. */
export async function withNumberRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') throw e;
      const target = (e.meta as { target?: unknown } | undefined)?.target;
      const names = Array.isArray(target) ? target.join(',') : String(target ?? '');
      if (!/requestNumber|visitNumber/.test(names)) throw e;
      last = e;
    }
  }
  throw last;
}
