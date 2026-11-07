import { PlanTemplateStatus, type Prisma } from '@prisma/client';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { materializePlan, pickApplicablePlans, type PlanScope } from './plan-scope';

/** What the callers read of a plan, beside its money: durations and the first legacy instalment. */
export const APPLICABLE_PLAN_INCLUDE = {
  durationOptions: { orderBy: { order: 'asc' } },
  scheduleItems: { orderBy: { paymentNumber: 'asc' } },
} satisfies Prisma.InstallmentPlanTemplateInclude;

type Db = Pick<Prisma.TransactionClient, 'unit' | 'installmentPlanTemplate'>;

/**
 * The plans a unit takes today, with TYPE / PROJECT plans already worked out on
 * the unit's price (see plan-scope.ts). One place for every caller — the
 * reservation form, the broker portal, the customer app — so they all agree.
 * `publicOnly` keeps the plans customers may see (a broker books on those).
 * Null when the unit does not exist in the tenant.
 */
export async function loadApplicablePlans(
  prisma: Db,
  unitId: string,
  opts: { publicOnly?: boolean; now?: Date } = {},
) {
  const companyId = getRequiredCompanyId();
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, companyId },
    select: { id: true, type: true, price: true, building: { select: { phase: { select: { projectId: true } } } } },
  });
  if (!unit) return null;
  const projectId = unit.building.phase.projectId;
  const plans = await prisma.installmentPlanTemplate.findMany({
    where: {
      companyId,
      projectId,
      status: PlanTemplateStatus.ACTIVE,
      OR: [{ unitId }, { unitId: null }],
      ...(opts.publicOnly ? { visibility: 'PUBLIC' } : {}),
    },
    include: APPLICABLE_PLAN_INCLUDE,
    orderBy: { createdAt: 'asc' },
  });
  const { scope, plans: picked } = pickApplicablePlans(
    plans,
    { id: unit.id, type: unit.type, price: unit.price, projectId },
    opts.now ?? new Date(),
  );
  return {
    unit: { id: unit.id, type: unit.type, price: unit.price, projectId },
    scope: scope as PlanScope | null,
    plans: picked.map((p) => materializePlan(p, unit.price)),
  };
}
