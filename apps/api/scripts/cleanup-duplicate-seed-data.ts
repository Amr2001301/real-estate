/**
 * One-time cleanup for duplicate demo data introduced by the pre-fix seed.
 *
 * Identifies projects that share a translatable name (ar OR en) with seed
 * demo projects, then for each such project counts every FK reference that
 * would block a safe delete (reservations, contracts, leads, visit requests,
 * visit appointments, info requests, maintenance requests, plan templates,
 * broker access rows, lead unit-interests).
 *
 * Deletion is performed ONLY when:
 *   - More than one project shares the name (i.e. it's a duplicate)
 *   - The candidate is NOT the oldest one
 *   - The candidate has ZERO references in every non-cascade relation
 *   - The --execute flag is passed
 *
 * BLOCK-by-leads handling (--delete-demo-leads):
 *   When the only thing blocking a duplicate project is one or more Lead rows
 *   created by the old non-idempotent seed, the script can also remove those
 *   demo leads. A lead is treated as deletable only if BOTH:
 *     - Its (fullName, phone, email) match the demo seed signature exactly
 *     - It has zero non-cascade dependents (reservations, visitRequests,
 *       visitAppointments, infoRequests, visitActivities)
 *   Leads that fail either check are printed and skipped — never auto-deleted.
 *
 * Run with:
 *   npx tsx scripts/cleanup-duplicate-seed-data.ts
 *       — dry-run, lists what would happen (default)
 *
 *   npx tsx scripts/cleanup-duplicate-seed-data.ts --execute
 *       — delete only duplicate projects with zero references
 *
 *   npx tsx scripts/cleanup-duplicate-seed-data.ts --execute --delete-demo-leads
 *       — additionally remove leads that match the demo seed signature so
 *         their duplicate projects can also be deleted (in one transaction)
 *
 * Cascade chain on Project delete removes: ProjectMedia, Phase → Building →
 * Unit → UnitMedia / UnitStatusHistory, Favorite, BrokerProjectAccess,
 * BrokerUnitAccess. Any non-cascade FK still attached will raise an FK error
 * and the transaction rolls back — that's the safety net.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const EXECUTE = process.argv.includes('--execute');
const DELETE_DEMO_LEADS = process.argv.includes('--delete-demo-leads');

// Pairs of (ar, en) used by the seed for demo projects.
const SEED_PROJECT_NAMES: Array<{ ar: string; en: string }> = [
  { ar: 'كمبوند الرياض الجديدة', en: 'New Riyadh Compound' },
  { ar: 'فيلات الجولف', en: 'Golf Villas' },
];

// The exact (fullName, phone, email) the demo seed has always written.
// A lead must match all three to be considered a demo lead.
const DEMO_LEAD_SIGNATURE = {
  fullName: 'Ahmed Khaled',
  phone: '+966500000001',
  email: 'ahmed@example.com',
};

type ProjectRow = {
  id: string;
  nameAr: string | null;
  nameEn: string | null;
  status: string;
  createdAt: Date;
};

type RefCounts = {
  units: number;
  reservations: number;
  contracts: number;
  leads: number;
  unitInterests: number;
  visitRequests: number;
  visitAppointments: number;
  infoRequests: number;
  maintenanceRequests: number;
  planTemplates: number;
  brokerProjectAccess: number;
  brokerUnitAccess: number;
};

type LeadDetails = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  clientId: string;
  projectInterestId: string | null;
  unitInterestId: string | null;
  stage: string;
  createdAt: Date;
};

type LeadDependents = {
  reservations: number;
  visitRequests: number;
  visitAppointments: number;
  infoRequests: number;
  visitActivities: number;
};

async function findCandidates(nameAr: string, nameEn: string): Promise<ProjectRow[]> {
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { name: { path: ['en'], equals: nameEn } },
        { name: { path: ['ar'], equals: nameAr } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, status: true, createdAt: true },
  });
  return projects.map((p) => {
    const nameJson = p.name as { ar?: string; en?: string } | null;
    return {
      id: p.id,
      nameAr: nameJson?.ar ?? null,
      nameEn: nameJson?.en ?? null,
      status: p.status,
      createdAt: p.createdAt,
    };
  });
}

async function projectUnitIds(projectId: string): Promise<string[]> {
  const units = await prisma.unit.findMany({
    where: { building: { phase: { projectId } } },
    select: { id: true },
  });
  return units.map((u) => u.id);
}

async function countReferences(projectId: string): Promise<RefCounts> {
  const unitIds = await projectUnitIds(projectId);

  const [
    reservations,
    contracts,
    leads,
    unitInterests,
    visitRequests,
    visitAppointments,
    infoRequests,
    maintenanceRequests,
    planTemplates,
    brokerProjectAccess,
    brokerUnitAccess,
  ] = await Promise.all([
    unitIds.length
      ? prisma.reservation.count({ where: { unitId: { in: unitIds } } })
      : Promise.resolve(0),
    unitIds.length
      ? prisma.contract.count({ where: { unitId: { in: unitIds } } })
      : Promise.resolve(0),
    prisma.lead.count({ where: { projectInterestId: projectId } }),
    unitIds.length
      ? prisma.lead.count({ where: { unitInterestId: { in: unitIds } } })
      : Promise.resolve(0),
    prisma.visitRequest.count({ where: { projectId } }),
    prisma.visitAppointment.count({ where: { projectId } }),
    prisma.infoRequest.count({ where: { projectId } }),
    unitIds.length
      ? prisma.maintenanceRequest.count({ where: { unitId: { in: unitIds } } })
      : Promise.resolve(0),
    prisma.installmentPlanTemplate.count({ where: { projectId } }),
    prisma.brokerProjectAccess.count({ where: { projectId } }),
    unitIds.length
      ? prisma.brokerUnitAccess.count({ where: { unitId: { in: unitIds } } })
      : Promise.resolve(0),
  ]);

  return {
    units: unitIds.length,
    reservations,
    contracts,
    leads,
    unitInterests,
    visitRequests,
    visitAppointments,
    infoRequests,
    maintenanceRequests,
    planTemplates,
    brokerProjectAccess,
    brokerUnitAccess,
  };
}

function isSafeToDelete(refs: RefCounts): boolean {
  // BrokerProjectAccess + BrokerUnitAccess cascade on delete; ignore them
  // for blocking purposes. Everything else must be zero.
  return (
    refs.reservations === 0 &&
    refs.contracts === 0 &&
    refs.leads === 0 &&
    refs.unitInterests === 0 &&
    refs.visitRequests === 0 &&
    refs.visitAppointments === 0 &&
    refs.infoRequests === 0 &&
    refs.maintenanceRequests === 0 &&
    refs.planTemplates === 0
  );
}

// True when leads are the *only* thing blocking the delete (no reservations,
// contracts, visits, info requests, maintenance, or plan templates attached).
function onlyLeadsBlock(refs: RefCounts): boolean {
  return (
    (refs.leads > 0 || refs.unitInterests > 0) &&
    refs.reservations === 0 &&
    refs.contracts === 0 &&
    refs.visitRequests === 0 &&
    refs.visitAppointments === 0 &&
    refs.infoRequests === 0 &&
    refs.maintenanceRequests === 0 &&
    refs.planTemplates === 0
  );
}

async function listBlockingLeads(projectId: string): Promise<LeadDetails[]> {
  const unitIds = await projectUnitIds(projectId);
  return prisma.lead.findMany({
    where: {
      OR: [
        { projectInterestId: projectId },
        ...(unitIds.length ? [{ unitInterestId: { in: unitIds } }] : []),
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      clientId: true,
      projectInterestId: true,
      unitInterestId: true,
      stage: true,
      createdAt: true,
    },
  });
}

async function countLeadDependents(leadId: string): Promise<LeadDependents> {
  const [reservations, visitRequests, visitAppointments, infoRequests, visitActivities] =
    await Promise.all([
      prisma.reservation.count({ where: { leadId } }),
      prisma.visitRequest.count({ where: { leadId } }),
      prisma.visitAppointment.count({ where: { leadId } }),
      prisma.infoRequest.count({ where: { leadId } }),
      prisma.visitActivity.count({ where: { leadId } }),
    ]);
  return { reservations, visitRequests, visitAppointments, infoRequests, visitActivities };
}

function matchesDemoSignature(lead: LeadDetails): boolean {
  return (
    lead.fullName === DEMO_LEAD_SIGNATURE.fullName &&
    lead.phone === DEMO_LEAD_SIGNATURE.phone &&
    (lead.email ?? '') === DEMO_LEAD_SIGNATURE.email
  );
}

async function main() {
  console.log(
    EXECUTE
      ? '⚠️  EXECUTE mode — deletions will happen.'
      : 'ℹ️  DRY-RUN — no changes will be written. Pass --execute (and optionally --delete-demo-leads) to apply.',
  );
  if (DELETE_DEMO_LEADS) {
    console.log(
      '   --delete-demo-leads: leads matching the demo seed signature will be removed along with their duplicate project, in a single transaction.',
    );
  }
  console.log('');

  let projectsDeleted = 0;
  let projectsSkipped = 0;
  let demoLeadsDeleted = 0;

  for (const { ar, en } of SEED_PROJECT_NAMES) {
    const projects = await findCandidates(ar, en);
    console.log(`▶ ${en} / ${ar}: found ${projects.length} matching project(s).`);

    if (projects.length <= 1) {
      console.log('  No duplicates. Skipping.\n');
      continue;
    }

    // Keep the OLDEST (first in createdAt asc order); inspect the rest.
    const [keep, ...candidates] = projects;
    console.log(
      `  KEEP   ${keep.id}  createdAt=${keep.createdAt.toISOString()}  status=${keep.status}`,
    );

    for (const c of candidates) {
      const refs = await countReferences(c.id);
      const refsSummary = `units=${refs.units} reservations=${refs.reservations} contracts=${refs.contracts} leads=${refs.leads} unitInterests=${refs.unitInterests} visitRequests=${refs.visitRequests} appointments=${refs.visitAppointments} infoRequests=${refs.infoRequests} maintenance=${refs.maintenanceRequests} planTemplates=${refs.planTemplates}`;

      // ── SAFE path: zero blockers ─────────────────────────────────────────
      if (isSafeToDelete(refs)) {
        console.log(
          `  SAFE   ${c.id}  createdAt=${c.createdAt.toISOString()}  ${refsSummary}`,
        );
        if (!EXECUTE) {
          console.log('         → would delete (cascade removes phases/buildings/units/media).');
          continue;
        }
        await prisma.project.delete({ where: { id: c.id } });
        console.log('         → deleted.');
        projectsDeleted++;
        continue;
      }

      console.log(
        `  BLOCK  ${c.id}  createdAt=${c.createdAt.toISOString()}  ${refsSummary}`,
      );

      // ── BLOCK path: hard blockers other than leads ───────────────────────
      if (!onlyLeadsBlock(refs)) {
        console.log(
          '         → blocked by non-lead references (reservations / contracts / visits / etc). Cannot auto-resolve; skipping.',
        );
        projectsSkipped++;
        continue;
      }

      // ── BLOCK path: only leads are blocking; inspect each lead ──────────
      const blockingLeads = await listBlockingLeads(c.id);

      type Verdict = {
        lead: LeadDetails;
        deps: LeadDependents;
        deletable: boolean;
        reasons: string[];
      };
      const verdicts: Verdict[] = [];

      for (const lead of blockingLeads) {
        const deps = await countLeadDependents(lead.id);
        const reasons: string[] = [];
        if (!matchesDemoSignature(lead)) reasons.push('does not match demo seed signature');
        if (deps.reservations > 0) reasons.push(`reservations=${deps.reservations}`);
        if (deps.visitRequests > 0) reasons.push(`visitRequests=${deps.visitRequests}`);
        if (deps.visitAppointments > 0) reasons.push(`visitAppointments=${deps.visitAppointments}`);
        if (deps.infoRequests > 0) reasons.push(`infoRequests=${deps.infoRequests}`);
        if (deps.visitActivities > 0) reasons.push(`visitActivities=${deps.visitActivities}`);
        verdicts.push({ lead, deps, deletable: reasons.length === 0, reasons });
      }

      // Always print the lead details (required even in dry-run).
      console.log(`         blocking leads (${verdicts.length}):`);
      for (const v of verdicts) {
        const l = v.lead;
        console.log(`           - id=${l.id}`);
        console.log(
          `             fullName=${JSON.stringify(l.fullName)} phone=${l.phone} email=${l.email ?? 'null'}`,
        );
        console.log(
          `             clientId=${l.clientId} projectInterestId=${l.projectInterestId ?? 'null'} unitInterestId=${l.unitInterestId ?? 'null'}`,
        );
        console.log(`             stage=${l.stage} createdAt=${l.createdAt.toISOString()}`);
        console.log(
          `             dependents: reservations=${v.deps.reservations} visitRequests=${v.deps.visitRequests} visitAppointments=${v.deps.visitAppointments} infoRequests=${v.deps.infoRequests} visitActivities=${v.deps.visitActivities}`,
        );
        if (v.deletable) {
          console.log(
            '             → matches demo seed signature with zero dependents (deletable with --delete-demo-leads)',
          );
        } else {
          console.log(`             → CANNOT auto-delete: ${v.reasons.join('; ')}`);
        }
      }

      const allDeletable = verdicts.every((v) => v.deletable);
      if (!allDeletable) {
        console.log(
          '         → at least one blocking lead does not match the demo seed signature or has real dependents. Resolve those leads manually, then re-run. Skipping.',
        );
        projectsSkipped++;
        continue;
      }

      if (!DELETE_DEMO_LEADS) {
        console.log(
          `         → all ${verdicts.length} blocking lead(s) are demo seed leads. Re-run with --execute --delete-demo-leads to remove them and the project together.`,
        );
        projectsSkipped++;
        continue;
      }

      if (!EXECUTE) {
        console.log(
          `         → would delete ${verdicts.length} demo lead(s) and then the project (cascades remove the unit/phase/building tree).`,
        );
        continue;
      }

      // Execute: delete demo leads + project in a single transaction so any
      // missed FK reference causes a full rollback.
      try {
        await prisma.$transaction(async (tx) => {
          for (const v of verdicts) {
            await tx.lead.delete({ where: { id: v.lead.id } });
          }
          await tx.project.delete({ where: { id: c.id } });
        });
        demoLeadsDeleted += verdicts.length;
        projectsDeleted++;
        console.log(
          `         → deleted ${verdicts.length} demo lead(s) and the project.`,
        );
      } catch (err) {
        projectsSkipped++;
        console.log(
          `         → transaction rolled back; leaving project intact. Error: ${(err as Error).message}`,
        );
      }
    }
    console.log('');
  }

  console.log(
    `Done. projects deleted=${projectsDeleted}, blocked/skipped=${projectsSkipped}, demo leads deleted=${demoLeadsDeleted}.`,
  );
  if (!EXECUTE) {
    console.log(
      'Re-run with --execute (add --delete-demo-leads if leads are blocking) to apply.',
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
