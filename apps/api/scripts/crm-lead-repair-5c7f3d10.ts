/**
 * CRM Lead Split Repair — Lead 5c7f3d10-278f-4ead-b4d8-05fe74424838
 *
 * The Tier-2 project-level merge bug collapsed Amr Tarek's 4 sold-unit
 * opportunities into a single WON lead. This script splits it into one WON
 * opportunity per converted unit, keeps the original lead for A-109, and
 * adds a full audit trail.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ BEFORE                                                                  │
 * │   Lead 5c7f3d10 (WON) ← RES-0004 (A-109, CONV) ← CON-2026-0001        │
 * │                        ← RES-0005 (A-101, CONV) ← CON-2026-0002  WRONG │
 * │                        ← RES-0006 (SH-1505,CONV)← CON-2026-0003  WRONG │
 * │                        ← RES-0007 (SH-1201,CONV)← CON-2026-0004  WRONG │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ AFTER                                                                   │
 * │   Lead 5c7f3d10 (WON) ← RES-0004 (A-109, CONV) ← CON-2026-0001  ✓     │
 * │   Lead <new-1>  (WON) ← RES-0005 (A-101, CONV) ← CON-2026-0002  ✓     │
 * │   Lead <new-2>  (WON) ← RES-0006 (SH-1505,CONV)← CON-2026-0003  ✓     │
 * │   Lead <new-3>  (WON) ← RES-0007 (SH-1201,CONV)← CON-2026-0004  ✓     │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Usage:
 *   # Dry-run (default — no DB changes):
 *   DATABASE_URL="..." npx ts-node -r tsconfig-paths/register \
 *     scripts/crm-lead-repair-5c7f3d10.ts
 *
 *   # Commit (single Prisma transaction — mutates DB):
 *   DATABASE_URL="..." npx ts-node -r tsconfig-paths/register \
 *     scripts/crm-lead-repair-5c7f3d10.ts --commit
 */

import { PrismaClient, LeadStage } from '@prisma/client';

const prisma = new PrismaClient();
const IS_COMMIT = process.argv.includes('--commit');

// ── Hardcoded repair targets ────────────────────────────────────────────────

const ORIGINAL_LEAD_ID = '5c7f3d10-278f-4ead-b4d8-05fe74424838';

/**
 * The three reservations that must be split onto their own unit-specific leads.
 * RES-2026-0001/0002/0003 are CANCELLED on A-109 and stay on the original lead.
 * RES-2026-0004 is CONVERTED on A-109 — that's the anchor for the original lead.
 */
const SPLITS = [
  {
    reservationId: '408fb02c-b2af-4924-8b75-784fe76afabd',
    reservationNumber: 'RES-2026-0005',
    unitId: '967f6e8b-de86-40c8-8404-8925046c08cb',
    unitCode: 'A-101',
    projectId: 'a2a79ecd-47ee-4126-a294-3df085fdec33',
    projectName: 'Moria Mall',
    contractId: '9748c7af-a807-4f70-bb1f-6e64d0af23a5',
    contractNumber: 'CON-2026-0002',
  },
  {
    reservationId: '809b9b36-33c9-42d3-bedd-a615663bd802',
    reservationNumber: 'RES-2026-0006',
    unitId: '5f92942c-b8e5-4ce3-993e-c730179892bf',
    unitCode: 'SH-1505',
    projectId: '389f0bc6-4433-4a78-9d47-12788e71096d',
    projectName: 'Solara Heights',
    contractId: 'fe5705c3-6cee-4540-bbf6-a726f0df865b',
    contractNumber: 'CON-2026-0003',
  },
  {
    reservationId: '4c3e3d7c-523c-4c32-b28a-2b6c8562ee76',
    reservationNumber: 'RES-2026-0007',
    unitId: 'a68e7711-3a6f-422b-a9b3-cc19ef949a14',
    unitCode: 'SH-1201',
    projectId: '389f0bc6-4433-4a78-9d47-12788e71096d',
    projectName: 'Solara Heights',
    contractId: '1c53688a-7a7e-44a9-9f03-ce19472921b8',
    contractNumber: 'CON-2026-0004',
  },
] as const;

// ── Safety checks ───────────────────────────────────────────────────────────

async function runSafetyChecks() {
  // 1. Original lead must exist and be WON.
  const lead = await prisma.lead.findUnique({
    where: { id: ORIGINAL_LEAD_ID },
    select: {
      id: true, fullName: true, stage: true, clientId: true,
      unitInterestId: true, projectInterestId: true,
      assignedSalesId: true, brokerId: true, brokerAgentId: true,
      sourceId: true, phone: true, email: true,
    },
  });
  if (!lead) {
    throw new Error(`SAFETY: Original lead ${ORIGINAL_LEAD_ID} not found in database.`);
  }
  if (lead.stage !== LeadStage.WON) {
    throw new Error(`SAFETY: Original lead stage is ${lead.stage}, expected WON. Aborting.`);
  }

  // 2. Client must exist and have the expected userId.
  const client = await prisma.user.findUnique({
    where: { id: lead.clientId },
    select: { id: true, fullName: true, phone: true, email: true, role: true },
  });
  if (!client) {
    throw new Error(`SAFETY: Client ${lead.clientId} linked to lead not found.`);
  }

  // 3. Every reservation in SPLITS must exist and currently point to the original lead
  //    OR have already been relinked (idempotency).
  const reservations = await prisma.reservation.findMany({
    where: { id: { in: SPLITS.map((s) => s.reservationId) } },
    select: { id: true, reservationNumber: true, leadId: true, unitId: true, status: true },
  });
  if (reservations.length !== SPLITS.length) {
    const found = reservations.map((r) => r.id);
    const missing = SPLITS.filter((s) => !found.includes(s.reservationId)).map((s) => s.reservationNumber);
    throw new Error(`SAFETY: Expected reservations not found: ${missing.join(', ')}`);
  }

  // 4. Verify no unexpected unitId mismatches (sanity check that hardcoded IDs match DB).
  for (const split of SPLITS) {
    const res = reservations.find((r) => r.id === split.reservationId)!;
    if (res.unitId !== split.unitId) {
      throw new Error(
        `SAFETY: ${split.reservationNumber} has unitId ${res.unitId} in DB ` +
        `but script expects ${split.unitId}. Data may have changed.`,
      );
    }
  }

  return { lead, client, reservations };
}

// ── Idempotency check ───────────────────────────────────────────────────────

function checkIdempotency(
  reservations: Array<{ id: string; reservationNumber: string | null; leadId: string | null }>,
) {
  const alreadyRelinked = SPLITS.filter((s) => {
    const res = reservations.find((r) => r.id === s.reservationId)!;
    return res.leadId !== ORIGINAL_LEAD_ID;
  });

  const stillOriginal = SPLITS.filter((s) => {
    const res = reservations.find((r) => r.id === s.reservationId)!;
    return res.leadId === ORIGINAL_LEAD_ID;
  });

  return { alreadyRelinked, stillOriginal };
}

// ── Dry-run printer ─────────────────────────────────────────────────────────

function printPlan(
  lead: { fullName: string; unitInterestId: string | null },
  client: { fullName: string; phone: string | null; email: string | null },
  idempotency: ReturnType<typeof checkIdempotency>,
) {
  const line = '─'.repeat(72);
  console.log();
  console.log('='.repeat(72));
  console.log(`CRM LEAD SPLIT REPAIR — ${IS_COMMIT ? 'COMMIT MODE' : 'DRY-RUN MODE'}`);
  console.log('='.repeat(72));
  console.log();

  // ── Step 0: Idempotency status
  if (idempotency.alreadyRelinked.length > 0) {
    console.log(`⚠  PARTIAL STATE DETECTED`);
    console.log(
      `   ${idempotency.alreadyRelinked.length} reservation(s) already relinked to a different lead:`,
    );
    idempotency.alreadyRelinked.forEach((s) =>
      console.log(`     ${s.reservationNumber} (${s.unitCode}) — SKIP`),
    );
    console.log();
  }
  if (idempotency.stillOriginal.length === 0) {
    console.log('✓  ALL RESERVATIONS ALREADY RELINKED — nothing to do.');
    console.log();
    return false;
  }

  // ── Step 1: fullName fix
  console.log(`${line}`);
  console.log(`STEP 1 — Fix stale fullName on original lead`);
  console.log(`${line}`);
  if (lead.fullName === client.fullName) {
    console.log(`  ✓ fullName already correct: "${lead.fullName}" — SKIP`);
  } else {
    console.log(`  Lead ${ORIGINAL_LEAD_ID}`);
    console.log(`    fullName:  "${lead.fullName}"  →  "${client.fullName}"`);
  }
  console.log();

  // ── Steps 2–4: one per split
  idempotency.stillOriginal.forEach((split, i) => {
    console.log(`${line}`);
    console.log(`STEP ${i + 2} — Create WON lead for ${split.unitCode} / ${split.projectName}`);
    console.log(`${line}`);
    console.log(`  NEW LEAD:`);
    console.log(`    clientId:          ${lead.unitInterestId ? '' : ''}${client.fullName} (same client)`);
    console.log(`    fullName:          "${client.fullName}"`);
    console.log(`    phone:             ${client.phone}`);
    console.log(`    email:             ${client.email ?? 'null'}`);
    console.log(`    unitInterestId:    ${split.unitId} (${split.unitCode})`);
    console.log(`    projectInterestId: ${split.projectId} (${split.projectName})`);
    console.log(`    stage:             WON`);
    console.log(`    (brokerId, brokerAgentId, sourceId, assignedSalesId copied from original)`);
    console.log();
    console.log(`  RELINK:`);
    console.log(`    Reservation ${split.reservationNumber}  leadId: ${ORIGINAL_LEAD_ID}  →  <new lead>`);
    console.log();
    console.log(`  AUDIT TRAIL (LeadActivity rows):`);
    console.log(`    <new lead>      type=created          payload={ reason: "split_from_5c7f3d10" }`);
    console.log(`    <new lead>      type=reservation      payload={ reservationId, contractId: ${split.contractId}, contractNumber: ${split.contractNumber} }`);
    console.log(`    <new lead>      type=status_change    payload={ from: WON, to: WON, reason: "split_repair" }`);
    console.log(`    ${ORIGINAL_LEAD_ID}  type=relinked_away    payload={ toUnit: ${split.unitCode}, reservationId: ${split.reservationId} }`);
    console.log();
  });

  // ── Summary
  console.log(`${line}`);
  console.log(`SUMMARY`);
  console.log(`${line}`);
  console.log(`  Operations to apply:`);
  console.log(`    1 lead UPDATE  (fullName fix on original)`);
  console.log(`    ${idempotency.stillOriginal.length} lead CREATE  (new WON leads)`);
  console.log(`    ${idempotency.stillOriginal.length} reservation UPDATE  (relink leadId)`);
  console.log(`    ${idempotency.stillOriginal.length * 4} LeadActivity INSERT  (audit trail, 4 per split)`);
  console.log();
  console.log(`  Expected pipeline result after repair:`);
  console.log(`    Lead 5c7f3d10 (original)  WON  A-109  / Moria Mall`);
  idempotency.stillOriginal.forEach((s) =>
    console.log(`    Lead <new>                WON  ${s.unitCode.padEnd(6)} / ${s.projectName}`),
  );
  console.log();

  if (!IS_COMMIT) {
    console.log(`  ► To apply, re-run with --commit`);
    console.log();
  }

  return true;
}

// ── Transaction (commit only) ───────────────────────────────────────────────

async function applyRepair(
  lead: {
    fullName: string; clientId: string; phone: string; email: string | null;
    assignedSalesId: string | null; brokerId: string | null;
    brokerAgentId: string | null; sourceId: string | null;
  },
  client: { fullName: string },
  splitsToApply: typeof SPLITS[number][],
) {
  return prisma.$transaction(async (tx) => {
    const results: string[] = [];

    // Step 1: fix stale fullName on original lead.
    if (lead.fullName !== client.fullName) {
      await tx.lead.update({
        where: { id: ORIGINAL_LEAD_ID },
        data: { fullName: client.fullName },
      });
      results.push(`  ✓ Updated original lead fullName → "${client.fullName}"`);
    } else {
      results.push(`  ✓ fullName already correct — skipped`);
    }

    // Steps 2–N: one per split.
    for (const split of splitsToApply) {
      // Create the new WON lead.
      const newLead = await tx.lead.create({
        data: {
          clientId: lead.clientId,
          fullName: client.fullName,
          phone: lead.phone,
          email: lead.email,
          sourceId: lead.sourceId,
          assignedSalesId: lead.assignedSalesId,
          brokerId: lead.brokerId,
          brokerAgentId: lead.brokerAgentId,
          projectInterestId: split.projectId,
          unitInterestId: split.unitId,
          stage: LeadStage.WON,
        },
      });

      // Relink the reservation to the new lead.
      await tx.reservation.update({
        where: { id: split.reservationId },
        data: { leadId: newLead.id },
      });

      // Audit: created activity on new lead.
      await tx.leadActivity.create({
        data: {
          leadId: newLead.id,
          type: 'created',
          payload: {
            reason: 'split_from_original',
            originalLeadId: ORIGINAL_LEAD_ID,
          },
        },
      });

      // Audit: reservation/contract reference on new lead.
      await tx.leadActivity.create({
        data: {
          leadId: newLead.id,
          type: 'reservation',
          payload: {
            status: 'CONVERTED',
            reservationId: split.reservationId,
            reservationNumber: split.reservationNumber,
            contractId: split.contractId,
            contractNumber: split.contractNumber,
            unitId: split.unitId,
            unitCode: split.unitCode,
          },
        },
      });

      // Audit: stage activity on new lead (confirm WON).
      await tx.leadActivity.create({
        data: {
          leadId: newLead.id,
          type: 'status_change',
          payload: {
            from: LeadStage.WON,
            to: LeadStage.WON,
            reason: 'split_repair — inherited WON from original lead',
          },
        },
      });

      // Audit: relinked_away on original lead.
      await tx.leadActivity.create({
        data: {
          leadId: ORIGINAL_LEAD_ID,
          type: 'relinked_away',
          payload: {
            toLeadId: newLead.id,
            reservationId: split.reservationId,
            reservationNumber: split.reservationNumber,
            unitCode: split.unitCode,
            reason: 'split_repair',
          },
        },
      });

      results.push(
        `  ✓ Created new WON lead ${newLead.id} for ${split.unitCode} ` +
        `(${split.reservationNumber} → ${split.contractNumber})`,
      );
    }

    return results;
  });
}

// ── Verification query (post-commit) ────────────────────────────────────────

async function printVerification() {
  const leads = await prisma.lead.findMany({
    where: { clientId: '4ecce8b9-f72d-42a3-a2c5-43d3b32c455e', stage: LeadStage.WON },
    select: {
      id: true, fullName: true, stage: true, unitInterestId: true,
      reservations: {
        select: { reservationNumber: true, status: true, unitId: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log();
  console.log('─'.repeat(72));
  console.log('POST-REPAIR VERIFICATION — WON leads for Amr Tarek');
  console.log('─'.repeat(72));
  leads.forEach((l) => {
    const converted = l.reservations.filter((r) => r.status === 'CONVERTED');
    console.log(`  Lead ${l.id.slice(0, 8)}...`);
    console.log(`    fullName:       ${l.fullName}`);
    console.log(`    unitInterestId: ${l.unitInterestId}`);
    console.log(`    stage:          ${l.stage}`);
    converted.forEach((r) =>
      console.log(`    reservation:    ${r.reservationNumber} (${r.status})`),
    );
  });
  console.log();
  console.log(`  Total WON leads for Amr Tarek: ${leads.length}`);
  console.log();
}

// ── Entry point ─────────────────────────────────────────────────────────────

async function main() {
  console.log();
  console.log(`Mode: ${IS_COMMIT ? '⚡ COMMIT (will mutate database)' : '🔍 DRY-RUN (read-only)'}`);
  console.log(`Target: Lead ${ORIGINAL_LEAD_ID}`);
  console.log();

  // Safety checks — always run, even in dry-run.
  let lead: Awaited<ReturnType<typeof runSafetyChecks>>['lead'];
  let client: Awaited<ReturnType<typeof runSafetyChecks>>['client'];
  let reservations: Awaited<ReturnType<typeof runSafetyChecks>>['reservations'];

  try {
    ({ lead, client, reservations } = await runSafetyChecks());
    console.log('✓ Safety checks passed.');
    console.log(`  Original lead:  ${lead.id}  stage=${lead.stage}  fullName="${lead.fullName}"`);
    console.log(`  Linked client:  ${client.id}  fullName="${client.fullName}"  role=${client.role}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`✗ ${message}`);
    process.exit(1);
  }

  // Idempotency check.
  const idempotency = checkIdempotency(reservations);
  const hasPendingWork = printPlan(lead, client, idempotency);

  if (!hasPendingWork) {
    console.log('Nothing to do. Exiting cleanly.');
    return;
  }

  if (!IS_COMMIT) {
    console.log('Dry-run complete. No data was changed.');
    return;
  }

  // Commit mode: apply inside a single transaction.
  console.log('Applying repair inside a single Prisma transaction…');
  console.log();

  try {
    const results = await applyRepair(lead, client, [...idempotency.stillOriginal]);
    console.log('Transaction committed successfully:');
    results.forEach((r) => console.log(r));
    await printVerification();
    console.log('✓ Repair complete.');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`✗ Transaction failed and was rolled back: ${message}`);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
