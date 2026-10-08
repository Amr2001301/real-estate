import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from '../tenant/tenant-context';

type Db = PrismaService | Prisma.TransactionClient;

/**
 * Next free contract number of the current company: `CON-<year>-<seq>`,
 * seq = highest of the year + 1, zero-padded to 4. Numbers are unique per
 * company (@@unique([companyId, contractNumber])). Two writers can compute the
 * same number; callers retry on isContractNumberConflict.
 */
export async function nextContractNumber(db: Db, now = new Date()): Promise<string> {
  // Every request runs in a tenant context; the Prisma tenant middleware scopes
  // the query too. Read optionally so callers outside a request (unit tests)
  // still work.
  const companyId = getTenantContext()?.companyId;
  const prefix = `CON-${now.getFullYear()}-`;
  const rows = await db.contract.findMany({
    where: { ...(companyId ? { companyId } : {}), contractNumber: { startsWith: prefix } },
    select: { contractNumber: true },
  });
  let maxSeq = 0;
  for (const { contractNumber } of rows) {
    if (!contractNumber) continue;
    const seq = parseInt(contractNumber.slice(prefix.length), 10);
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
}

/** A unique-constraint violation on the contract number. */
export function isContractNumberConflict(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') return false;
  const target = (e.meta as { target?: unknown } | undefined)?.target;
  return Array.isArray(target)
    ? target.includes('contractNumber')
    : typeof target === 'string' && target.includes('contractNumber');
}
