/**
 * One-time deduplication script.
 *
 * Finds clients who have both a generic open opportunity (projectInterestId=null,
 * unitInterestId=null) AND a specific open opportunity (projectInterestId!=null).
 * Marks the generic one as LOST so it disappears from the active CRM board.
 *
 * Run with:  npx tsx scripts/dedupe-generic-leads.ts
 * Dry-run:   npx tsx scripts/dedupe-generic-leads.ts --dry-run
 */
import { PrismaClient, LeadStage } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

const OPEN_STAGES: LeadStage[] = [
  LeadStage.NEW,
  LeadStage.INTERESTED,
  LeadStage.VISIT,
  LeadStage.NEGOTIATION,
];

async function main() {
  console.log(DRY_RUN ? '[DRY RUN] No changes will be written.\n' : '');

  // Fetch all open generic opportunities (no project, no unit)
  const genericLeads = await prisma.lead.findMany({
    where: {
      projectInterestId: null,
      unitInterestId: null,
      stage: { in: OPEN_STAGES },
    },
    select: { id: true, clientId: true, stage: true, fullName: true },
  });

  console.log(`Found ${genericLeads.length} open generic opportunity(ies) to inspect.`);

  let archived = 0;
  for (const generic of genericLeads) {
    // Check if same client has any open specific opportunity
    const specific = await prisma.lead.findFirst({
      where: {
        clientId: generic.clientId,
        id: { not: generic.id },
        projectInterestId: { not: null },
        stage: { in: OPEN_STAGES },
      },
      select: { id: true, projectInterestId: true, stage: true },
    });

    if (!specific) continue;

    console.log(
      `  [${generic.fullName}] generic lead ${generic.id} (${generic.stage}) ` +
      `superseded by ${specific.id} (project: ${specific.projectInterestId}, ${specific.stage})`,
    );

    if (!DRY_RUN) {
      await prisma.$transaction(async (tx) => {
        await tx.lead.update({
          where: { id: generic.id },
          data: { stage: LeadStage.LOST },
        });
        await tx.leadActivity.create({
          data: {
            leadId: generic.id,
            type: 'status_change',
            payload: {
              from: generic.stage,
              to: LeadStage.LOST,
              reason: `Archived: superseded by specific opportunity ${specific.id} (project ${specific.projectInterestId})`,
            },
          },
        });
      });
    }

    archived++;
  }

  const verb = DRY_RUN ? 'Would archive' : 'Archived';
  console.log(`\nDone. ${verb} ${archived} generic duplicate opportunity(ies).`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
