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
 * Four-tier CRM opportunity matching for client-owned actions (reservation or visit).
 *
 * Priority:
 *   1. Open opportunity for same clientId + unitInterestId  (unit-specific)
 *   2. Open opportunity for same clientId + projectInterestId  (project-level)
 *   3. Open generic opportunity (projectInterestId = null, unitInterestId = null) →
 *      upgraded in-place with the selected project/unit so the board stays clean
 *   4. None found → create a new scoped opportunity
 *
 * The caller is responsible for logging the domain-specific activity
 * (type='reservation' or type='visit') after receiving the leadId.
 */
export async function matchOrCreateLeadForClient(
  tx: Pick<Prisma.TransactionClient, 'lead' | 'leadActivity'>,
  opts: LeadMatchOpts,
): Promise<LeadMatchResult> {
  const { clientId, projectId, unitId, bumpableStages, targetStage } = opts;

  // Tier 1: unit-specific open opportunity
  const byUnit = unitId
    ? await tx.lead.findFirst({
        where: { clientId, unitInterestId: unitId, stage: { in: bumpableStages } },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, stage: true },
      })
    : null;

  // Tier 2: project-level open opportunity
  const byProject = byUnit ?? await tx.lead.findFirst({
    where: { clientId, projectInterestId: projectId, stage: { in: bumpableStages } },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, stage: true },
  });

  // Tier 3: generic open opportunity (no project, no unit) — upgrade it in-place
  const match = byProject ?? await tx.lead.findFirst({
    where: {
      clientId,
      projectInterestId: null,
      unitInterestId: null,
      stage: { in: bumpableStages },
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, stage: true },
  });

  if (match) {
    const isGenericUpgrade = !byUnit && !byProject;
    await tx.lead.update({
      where: { id: match.id },
      data: {
        stage: targetStage,
        // Upgrade generic opportunity to be scoped to this project/unit
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

  // Tier 4: no open opportunity found — create a new scoped one
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
