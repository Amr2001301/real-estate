import { Prisma } from '@prisma/client';

/**
 * A project grant that lets the broker work now: active, and inside its
 * startsAt / endsAt window when one is set. The dates used to be stored but
 * never read, so a grant kept working before it started and after it ended.
 */
export function liveProjectGrant(at: Date = new Date()): Prisma.BrokerProjectAccessWhereInput {
  return {
    active: true,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: at } }] },
      { OR: [{ endsAt: null }, { endsAt: { gt: at } }] },
    ],
  };
}
