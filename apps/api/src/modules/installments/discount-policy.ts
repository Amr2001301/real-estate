/**
 * Discount limit — a company setting with an approval permission above it.
 *
 * `pricing.maxDiscountPct` caps the discount off a unit's price that anyone
 * may give on a contract or a price plan (100 = no cap, the default until the
 * company sets one). Above it, only a user holding `pricing:approve-discount`
 * may — an ADMIN too needs the code (no admin bypass), so the cap binds every
 * admin but the owners the company trusts with it. Every discount given is
 * written to the audit log: who, on what, how much.
 */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const MAX_DISCOUNT_KEY = 'pricing.maxDiscountPct';
export const MAX_DISCOUNT_DEFAULT = 100;
export const APPROVE_DISCOUNT_PERMISSION = 'pricing:approve-discount';

export const DISCOUNT_SETTING_VALIDATORS: Record<string, (key: string, v: unknown) => void> = {
  [MAX_DISCOUNT_KEY]: (k, v) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) {
      throw new BadRequestException(`${k}: must be a number between 0 and 100`);
    }
  },
};

/** The discount, as a percent of `listPrice`, of selling at `salePrice` (0 when not below). */
export function discountPct(listPrice: number, salePrice: number): number {
  if (!(listPrice > 0) || salePrice >= listPrice) return 0;
  return Math.round(((listPrice - salePrice) / listPrice) * 10_000) / 100;
}

type Db = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setting: { findFirst: (...args: any[]) => Promise<{ value: unknown } | null> };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userPermission: { count: (...args: any[]) => Promise<number> };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auditLog: { create: (...args: any[]) => Promise<unknown> };
};

/**
 * Throws when `pct` is over the company's cap and the actor can't approve it;
 * records any discount given.
 */
export async function assertDiscountAllowed(
  db: Db,
  opts: {
    companyId: string;
    actorId: string;
    pct: number;
    listPrice: number;
    salePrice: number;
    entityType: string;
    entityId?: string | null;
  },
): Promise<void> {
  if (opts.pct <= 0) return;
  const row = await db.setting.findFirst({
    where: { companyId: opts.companyId, key: MAX_DISCOUNT_KEY },
    select: { value: true },
  });
  const v = row?.value;
  const cap = typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100 ? v : MAX_DISCOUNT_DEFAULT;
  const overCap = opts.pct > cap;
  if (overCap) {
    const approver = await db.userPermission.count({
      where: { userId: opts.actorId, permission: { code: APPROVE_DISCOUNT_PERMISSION } },
    });
    if (approver === 0) {
      throw new ForbiddenException(
        `الخصم ${opts.pct}% أكبر من الحد المسموح (${cap}%) — يحتاج موافقة من صاحب صلاحية اعتماد الخصم`,
      );
    }
  }
  await db.auditLog.create({
    data: {
      actorId: opts.actorId,
      action: overCap ? 'pricing.discount-approved' : 'pricing.discount-given',
      entityType: opts.entityType,
      entityId: opts.entityId ?? null,
      after: {
        discountPct: opts.pct,
        capPct: cap,
        listPrice: opts.listPrice,
        salePrice: opts.salePrice,
      } satisfies Prisma.InputJsonValue,
      companyId: opts.companyId,
    },
  });
}
