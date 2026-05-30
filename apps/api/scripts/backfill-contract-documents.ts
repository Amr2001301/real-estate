/**
 * One-time backfill: register a CUSTOMER_VISIBLE CONTRACT Document for every
 * contract created BEFORE P12 that has a `pdfUrl` but no CONTRACT-category
 * Document. Pre-P12 conversion/create only stamped `contract.pdfUrl` without
 * registering a Document, so the file is invisible in /dashboard/documents and
 * the customer's signed-download lookup finds nothing ("العقد غير متاح بعد").
 *
 * Behaviour:
 *   - Dry-run by default; pass --execute to write.
 *   - Idempotent: skips any contract that already has a CONTRACT document
 *     (so re-running, or a contract already fixed by the P12 hooks, is a no-op).
 *   - Reuses ContractsService.backfillContractDocument so the row shape matches
 *     P12-created documents exactly (CUSTOMER_VISIBLE, category CONTRACT,
 *     fileUrl = pdfUrl verbatim, uploadedById = null).
 *   - Sends NO notifications — legacy contracts are often long finalised and
 *     mass-notifying on backfill would spam customers. New contracts keep
 *     notifying via the P12 hooks.
 *   - Never updates or deletes existing rows; never exposes a permanent URL.
 *
 * Implementation note: we use a direct PrismaClient + a hand-constructed
 * ContractsService (its backfill method only touches `prisma`) rather than
 * booting the full Nest AppModule. This mirrors the other data scripts
 * (cleanup-duplicate-seed-data.ts) and avoids pulling in auth/passport DI.
 *
 * Run with:
 *   npx tsx scripts/backfill-contract-documents.ts            (dry-run)
 *   npx tsx scripts/backfill-contract-documents.ts --execute  (writes)
 *
 * or via package scripts:
 *   pnpm --filter api contracts:backfill-documents:dry-run
 *   pnpm --filter api contracts:backfill-documents            (writes)
 */
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { ContractsService } from '../src/modules/contracts/contracts.module';

const EXECUTE = process.argv.includes('--execute');

async function main(): Promise<void> {
  console.log(
    EXECUTE
      ? '⚠️  EXECUTE mode — contract documents will be written.'
      : 'ℹ️  DRY-RUN — no changes will be written. Pass --execute to apply.',
  );
  console.log('');

  const prisma = new PrismaClient();
  // backfillContractDocument only uses `this.prisma`; the other constructor
  // deps are never touched on this path, so stubs are safe.
  const contracts = new ContractsService(
    prisma as unknown as PrismaService,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
  );

  try {
    const candidates = await prisma.contract.findMany({
      where: { NOT: { pdfUrl: null } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, contractNumber: true, pdfUrl: true },
    });

    let created = 0;
    let wouldCreate = 0;
    let exists = 0;
    let noUrl = 0;

    for (const c of candidates) {
      const result = await contracts.backfillContractDocument(c, { dryRun: !EXECUTE });
      const label = c.contractNumber ?? c.id;
      switch (result) {
        case 'created':
          created++;
          console.log(`  ✓ created CONTRACT document for ${label}`);
          break;
        case 'would-create':
          wouldCreate++;
          console.log(`  • would create CONTRACT document for ${label}`);
          break;
        case 'exists':
          exists++;
          break;
        case 'no-pdfurl':
          noUrl++;
          break;
      }
    }

    console.log('');
    console.log(`Scanned ${candidates.length} contract(s) with a non-null pdfUrl.`);
    if (EXECUTE) {
      console.log(
        `Created ${created} · already had a document ${exists} · empty pdfUrl skipped ${noUrl}`,
      );
    } else {
      console.log(
        `Would create ${wouldCreate} · already have a document ${exists} · empty pdfUrl ${noUrl} ` +
          `(dry-run — pass --execute to apply)`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
