/**
 * One-time deduplication script — DRY-RUN BY DEFAULT.
 *
 * Finds clients who have both a generic open opportunity (projectInterestId=null,
 * unitInterestId=null) AND a specific open opportunity (projectInterestId!=null).
 * Marks the generic one as LOST so it disappears from the active CRM board.
 *
 * This script never hard-deletes. It only transitions the generic lead's
 * stage to LOST and appends a `status_change` LeadActivity row documenting
 * why. Even so, the change is irreversible without manual SQL, so we gate
 * it behind two flags.
 *
 * Usage:
 *   npx tsx scripts/dedupe-generic-leads.ts
 *     — DRY-RUN (default). Prints the plan, the affected lead ids, and any
 *       groups blocked by safety guards. NO changes are written.
 *
 *   npx tsx scripts/dedupe-generic-leads.ts --execute --confirm
 *     — Writes the status transitions inside a per-group transaction. Both
 *       flags are required. Missing `--confirm` aborts.
 *
 * Safety guards (always applied — even with --execute):
 *   A generic lead is SKIPPED (never archived) if any of the following are
 *   true for that lead row:
 *     • has any Reservation rows                  (real downstream commitment)
 *     • has any VisitAppointment rows             (real engagement happened)
 *     • has any InfoRequest rows                  (treat as engagement)
 *     • broker-attributed (brokerId IS NOT NULL)  (broker lifecycle owns it)
 *
 *   Ambiguous groups — a client with 2+ specific open leads — are SKIPPED:
 *   we don't know which one "supersedes" the generic without product input.
 *
 *   Generic leads without a specific counterpart are SKIPPED (nothing to
 *   dedupe).
 *
 * Output legend:
 *   ➜ ARCHIVE   would archive (or did archive in --execute)
 *   ⊘ SKIP      safety guard blocked or no counterpart
 *   ⚠ BLOCK     ambiguous; needs manual review
 */
import { LeadStage, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EXECUTE = process.argv.includes('--execute');
const CONFIRM = process.argv.includes('--confirm');

// Belt-and-braces: --execute without --confirm aborts immediately. Tab-
// completion can land you in trouble otherwise.
if (EXECUTE && !CONFIRM) {
  console.error(
    '❌ Refusing to run: --execute requires --confirm. Re-run with both flags, ' +
      'or omit both for a dry-run.',
  );
  process.exit(2);
}

const DRY_RUN = !EXECUTE;
const MODE_BANNER = DRY_RUN
  ? '🔍 DRY-RUN — no changes will be written. Re-run with --execute --confirm to apply.'
  : '⚠️  EXECUTE — changes WILL be written inside per-group transactions.';

const OPEN_STAGES: LeadStage[] = [
  LeadStage.NEW,
  LeadStage.INTERESTED,
  LeadStage.VISIT,
  LeadStage.NEGOTIATION,
];

interface ArchivePlan {
  generic: { id: string; clientId: string; fullName: string; stage: LeadStage };
  specific: { id: string; projectInterestId: string | null; stage: LeadStage };
}

interface Tally {
  inspected: number;
  archived: number;
  noCounterpart: number;
  ambiguous: number;
  blockedByDependents: number;
}

async function main() {
  console.log(MODE_BANNER);
  console.log('');

  const genericLeads = await prisma.lead.findMany({
    where: {
      projectInterestId: null,
      unitInterestId: null,
      stage: { in: OPEN_STAGES },
    },
    select: {
      id: true,
      clientId: true,
      stage: true,
      fullName: true,
      brokerId: true,
      _count: {
        select: {
          reservations: true,
          appointments: true,
          infoRequests: true,
        },
      },
    },
  });

  console.log(`Inspecting ${genericLeads.length} open generic opportunity(ies).`);
  console.log('');

  const tally: Tally = {
    inspected: genericLeads.length,
    archived: 0,
    noCounterpart: 0,
    ambiguous: 0,
    blockedByDependents: 0,
  };

  const plans: ArchivePlan[] = [];

  for (const generic of genericLeads) {
    // Safety guard 1: broker-attributed generic leads are off-limits to this
    // script. The broker lifecycle has its own approval/rejection states.
    if (generic.brokerId) {
      console.log(
        `⊘ SKIP   ${generic.id} (${generic.fullName}) — broker-attributed lead; broker flow owns its lifecycle.`,
      );
      tally.blockedByDependents++;
      continue;
    }

    // Safety guard 2: dependent records on the generic lead itself. If a
    // generic lead has reservations / appointments / info requests, it's
    // not truly "generic" anymore — real engagement exists. Don't touch.
    const dependents = generic._count;
    const blockerNotes: string[] = [];
    if (dependents.reservations > 0) blockerNotes.push(`${dependents.reservations} reservation(s)`);
    if (dependents.appointments > 0) blockerNotes.push(`${dependents.appointments} appointment(s)`);
    if (dependents.infoRequests > 0) blockerNotes.push(`${dependents.infoRequests} info request(s)`);
    if (blockerNotes.length > 0) {
      console.log(
        `⊘ SKIP   ${generic.id} (${generic.fullName}) — has dependents: ${blockerNotes.join(', ')}.`,
      );
      tally.blockedByDependents++;
      continue;
    }

    // Find ALL specific open leads for this client so we can detect ambiguity.
    const specifics = await prisma.lead.findMany({
      where: {
        clientId: generic.clientId,
        id: { not: generic.id },
        projectInterestId: { not: null },
        stage: { in: OPEN_STAGES },
      },
      select: { id: true, projectInterestId: true, stage: true },
    });

    if (specifics.length === 0) {
      console.log(
        `⊘ SKIP   ${generic.id} (${generic.fullName}) — no specific counterpart for this client.`,
      );
      tally.noCounterpart++;
      continue;
    }

    if (specifics.length > 1) {
      // The client has multiple specific opens. We don't know which
      // supersedes the generic; let a human pick.
      console.log(
        `⚠ BLOCK  ${generic.id} (${generic.fullName}) — ambiguous: ${specifics.length} specific open lead(s) ` +
          `[${specifics.map((s) => s.id).join(', ')}]. Needs manual review.`,
      );
      tally.ambiguous++;
      continue;
    }

    const specific = specifics[0]!;
    const groupKey = `client:${generic.clientId} project:${specific.projectInterestId ?? '∅'}`;
    console.log(
      `➜ ARCHIVE ${generic.id} (${generic.fullName}, ${generic.stage}) ` +
        `→ superseded by ${specific.id} (${specific.stage})  [group ${groupKey}]`,
    );
    plans.push({
      generic: {
        id: generic.id,
        clientId: generic.clientId,
        fullName: generic.fullName,
        stage: generic.stage,
      },
      specific,
    });
  }

  console.log('');

  if (DRY_RUN) {
    console.log(`Plan: would archive ${plans.length} generic lead(s).`);
    printTally(tally, plans.length);
    return;
  }

  // EXECUTE path. Each archive runs in its own transaction so a single
  // failure doesn't cascade across unrelated groups.
  for (const plan of plans) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.lead.update({
          where: { id: plan.generic.id },
          data: { stage: LeadStage.LOST },
        });
        await tx.leadActivity.create({
          data: {
            leadId: plan.generic.id,
            type: 'status_change',
            payload: {
              from: plan.generic.stage,
              to: LeadStage.LOST,
              reason:
                `Archived: superseded by specific opportunity ${plan.specific.id} ` +
                `(project ${plan.specific.projectInterestId})`,
              source: 'dedupe-generic-leads.ts',
            },
          },
        });
      });
      tally.archived++;
    } catch (e) {
      console.error(`❌ FAIL    ${plan.generic.id} — ${(e as Error).message}`);
    }
  }

  printTally(tally, plans.length);
}

function printTally(tally: Tally, planned: number) {
  console.log('');
  console.log('Summary:');
  console.log(`  inspected            : ${tally.inspected}`);
  console.log(`  planned to archive   : ${planned}`);
  console.log(`  actually archived    : ${tally.archived}`);
  console.log(`  skipped (no match)   : ${tally.noCounterpart}`);
  console.log(`  blocked (dependents) : ${tally.blockedByDependents}`);
  console.log(`  blocked (ambiguous)  : ${tally.ambiguous}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
