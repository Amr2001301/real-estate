/**
 * CRM Lead Data Repair — DRY RUN ONLY
 *
 * Identifies three categories of legacy data inconsistency introduced by the
 * Tier-2 project-level merge bug (Bug A) and the missing leadId persistence
 * bug (Bug C). Prints affected rows to stdout. Makes NO database mutations.
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register scripts/crm-lead-repair-dry-run.ts
 *
 * After reviewing the output, promote to a real migration only when:
 *   1. Output has been reviewed row-by-row.
 *   2. A database backup exists.
 *   3. The migration runs inside a single transaction with an explicit ROLLBACK
 *      checkpoint before committing.
 */

import { PrismaClient, LeadStage } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(72));
  console.log('CRM LEAD REPAIR — DRY RUN');
  console.log('='.repeat(72));
  console.log();

  // ─── Category 1 ────────────────────────────────────────────────────────────
  // Reservations with clientId but no leadId (Bug C — not persisted at create).
  // These need to be linked to the most recent open unit-specific lead for
  // the same client + unit, if one exists.
  console.log('─── Category 1: reservations with clientId but leadId=null ───');
  const nullLeadReservations = await prisma.reservation.findMany({
    where: { leadId: null, clientId: { not: null } },
    select: {
      id: true,
      reservationNumber: true,
      status: true,
      unitId: true,
      clientId: true,
      client: { select: { fullName: true, phone: true } },
      unit: { select: { code: true, building: { select: { phase: { select: { projectId: true } } } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const openStages: LeadStage[] = [
    LeadStage.NEW, LeadStage.INTERESTED, LeadStage.VISIT, LeadStage.NEGOTIATION,
  ];

  let cat1Linkable = 0;
  let cat1Ambiguous = 0;
  let cat1NoMatch = 0;

  for (const res of nullLeadReservations) {
    const candidates = await prisma.lead.findMany({
      where: {
        clientId: res.clientId!,
        unitInterestId: res.unitId,
        stage: { in: openStages },
      },
      select: { id: true, stage: true, createdAt: true },
      orderBy: { updatedAt: 'desc' },
    });

    const label = `  RES ${res.reservationNumber ?? res.id} | client=${res.client?.fullName} (${res.client?.phone}) | unit=${res.unit?.code} | status=${res.status}`;

    if (candidates.length === 1) {
      console.log(`${label}`);
      console.log(`    → LINKABLE: would set leadId=${candidates[0]!.id} (stage=${candidates[0]!.stage})`);
      cat1Linkable++;
    } else if (candidates.length > 1) {
      console.log(`${label}`);
      console.log(`    → AMBIGUOUS: ${candidates.length} candidate leads — manual review needed`);
      candidates.forEach((c) => console.log(`       lead=${c.id} stage=${c.stage}`));
      cat1Ambiguous++;
    } else {
      console.log(`${label}`);
      console.log(`    → NO MATCH: no open unit-specific lead found for this client+unit`);
      cat1NoMatch++;
    }
  }

  console.log();
  console.log(
    `Category 1 summary: ${nullLeadReservations.length} reservations | ` +
    `${cat1Linkable} linkable | ${cat1Ambiguous} ambiguous | ${cat1NoMatch} no-match`,
  );
  console.log();

  // ─── Category 2 ────────────────────────────────────────────────────────────
  // Reservations where leadId is set but lead.unitInterestId ≠ reservation.unitId.
  // This is the Bug A / Tier-2 cross-unit merge artefact.
  console.log('─── Category 2: reservations with mismatched leadId ────────────');
  const allLinkedReservations = await prisma.reservation.findMany({
    where: { leadId: { not: null } },
    select: {
      id: true,
      reservationNumber: true,
      status: true,
      unitId: true,
      leadId: true,
      lead: {
        select: {
          id: true,
          stage: true,
          unitInterestId: true,
          fullName: true,
          phone: true,
        },
      },
      unit: { select: { code: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const mismatched = allLinkedReservations.filter(
    (r) =>
      r.lead?.unitInterestId !== null &&
      r.lead?.unitInterestId !== r.unitId,
  );

  for (const res of mismatched) {
    const correctCandidate = await prisma.lead.findFirst({
      where: {
        clientId: res.lead!.id,
        unitInterestId: res.unitId,
        stage: { in: openStages },
      },
      select: { id: true, stage: true },
      orderBy: { updatedAt: 'desc' },
    });

    console.log(
      `  RES ${res.reservationNumber ?? res.id} | client=${res.lead?.fullName} (${res.lead?.phone}) | unit=${res.unit?.code} | status=${res.status}`,
    );
    console.log(
      `    current leadId=${res.leadId} (unitInterestId=${res.lead?.unitInterestId}) ← MISMATCH`,
    );
    if (correctCandidate) {
      console.log(`    → RELINKABLE: found correct lead=${correctCandidate.id} (stage=${correctCandidate.stage})`);
    } else {
      console.log(`    → WOULD CREATE: new lead scoped to unit=${res.unitId}`);
    }
  }

  console.log();
  console.log(`Category 2 summary: ${mismatched.length} mismatched reservations found`);
  console.log();

  // ─── Category 3 ────────────────────────────────────────────────────────────
  // WON leads linked (via reservation chain) to contracts for different units.
  // These are collapsed opportunities that should be separate pipeline entries.
  console.log('─── Category 3: WON leads covering multiple distinct units ─────');
  const wonLeads = await prisma.lead.findMany({
    where: { stage: LeadStage.WON },
    select: {
      id: true,
      fullName: true,
      phone: true,
      unitInterestId: true,
      reservations: {
        select: {
          id: true,
          reservationNumber: true,
          unitId: true,
          status: true,
          unit: { select: { code: true } },
          contract: { select: { id: true, contractNumber: true } },
        },
      },
    },
  });

  let cat3Count = 0;
  for (const lead of wonLeads) {
    const uniqueUnits = new Set(lead.reservations.map((r) => r.unitId));
    if (uniqueUnits.size > 1) {
      console.log(`  LEAD ${lead.id} | client=${lead.fullName} (${lead.phone})`);
      console.log(`    unitInterestId=${lead.unitInterestId} | WON`);
      for (const r of lead.reservations) {
        console.log(
          `    → RES ${r.reservationNumber ?? r.id} | unit=${r.unit?.code} (${r.unitId}) | ` +
          `status=${r.status} | contract=${r.contract?.contractNumber ?? 'none'}`,
        );
      }
      console.log(`    NEEDS SPLIT: ${uniqueUnits.size} distinct units collapsed into 1 lead`);
      cat3Count++;
    }
  }

  console.log();
  console.log(`Category 3 summary: ${cat3Count} WON leads covering multiple distinct units`);
  console.log();

  // ─── Grand summary ─────────────────────────────────────────────────────────
  console.log('='.repeat(72));
  console.log('GRAND SUMMARY (no mutations performed)');
  console.log(`  Category 1 (null leadId): ${nullLeadReservations.length} reservations`);
  console.log(`  Category 2 (mismatched leadId): ${mismatched.length} reservations`);
  console.log(`  Category 3 (collapsed WON leads): ${cat3Count} leads`);
  console.log('='.repeat(72));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
