import { LeadStage, Prisma } from '@prisma/client';

export interface LeadMatchOpts {
  clientId: string;
  projectId: string;
  unitId: string | null;
  bumpableStages: LeadStage[];
  targetStage: LeadStage;
  clientFullName: string;
  clientPhone: string;
  clientEmail: string | null;
  assignedSalesId: string | null;
}

export interface LeadMatchResult {
  leadId: string;
  isNew: boolean;
}

/**
 * Three-tier CRM opportunity matching for client-owned actions (reservation or visit).
 *
 * Priority:
 *   1. Open opportunity for same clientId + unitInterestId  (exact unit match)
 *   2. Open generic opportunity (projectInterestId = null, unitInterestId = null)
 *      with no committed reservations and no unit-specific appointments →
 *      upgraded in-place so the pipeline board stays clean
 *   3. None found → create a new scoped opportunity
 *
 * Tier 2 (project-level merge) was intentionally removed: it collapsed
 * opportunities for different units in the same project into a single lead,
 * corrupting the per-unit pipeline view.
 *
 * The caller is responsible for logging the domain-specific activity
 * (type='reservation' or type='visit') after receiving the leadId.
 */
export async function matchOrCreateLeadForClient(
  tx: Pick<Prisma.TransactionClient, 'lead' | 'leadActivity'>,
  opts: LeadMatchOpts,
): Promise<LeadMatchResult> {
  const { clientId, projectId, unitId, bumpableStages, targetStage } = opts;

  // Tier 1: exact unit-specific open opportunity
  const byUnit = unitId
    ? await tx.lead.findFirst({
        where: { clientId, unitInterestId: unitId, stage: { in: bumpableStages } },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, stage: true },
      })
    : null;

  // Tier 2: clean generic opportunity (no project, no unit, no committed activities).
  // Skip if Tier 1 already found a match.
  const generic = byUnit
    ? null
    : await tx.lead.findFirst({
        where: {
          clientId,
          projectInterestId: null,
          unitInterestId: null,
          stage: { in: bumpableStages },
          reservations: { none: {} },
          appointments: { none: { unitId: { not: null } } },
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, stage: true },
      });

  const match = byUnit ?? generic;

  if (match) {
    const isGenericUpgrade = !byUnit && !!generic;
    await tx.lead.update({
      where: { id: match.id },
      data: {
        stage: targetStage,
        ...(isGenericUpgrade ? { projectInterestId: projectId, unitInterestId: unitId } : {}),
      },
    });
    await tx.leadActivity.create({
      data: {
        leadId: match.id,
        type: 'status_change',
        payload: {
          from: match.stage,
          to: targetStage,
          ...(isGenericUpgrade
            ? { reason: `Upgraded from generic opportunity to project ${projectId}` }
            : {}),
        },
      },
    });
    return { leadId: match.id, isNew: false };
  }

  // Tier 3: no open opportunity found — create a new scoped one
  const newLead = await tx.lead.create({
    data: {
      clientId,
      fullName: opts.clientFullName,
      phone: opts.clientPhone,
      email: opts.clientEmail ?? null,
      projectInterestId: projectId,
      unitInterestId: unitId,
      assignedSalesId: opts.assignedSalesId,
      stage: targetStage,
    },
  });
  await tx.leadActivity.create({
    data: { leadId: newLead.id, type: 'created', payload: {} },
  });
  return { leadId: newLead.id, isNew: true };
}
