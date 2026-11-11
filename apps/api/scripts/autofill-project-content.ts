/**
 * One-time fill of the project page content for projects made before it
 * existed: sections (location, details, units and areas), the FAQ answered
 * from the project's own records, and icons for amenities saved as a plain
 * tick. See src/modules/projects/project-autofill.ts — nothing is invented,
 * and the construction progress is never filled (no record holds it).
 *
 * Only empty content is filled: a project whose sections or FAQ were already
 * written keeps them; an amenity with a chosen icon keeps it.
 *
 *   npx tsx scripts/autofill-project-content.ts            (dry-run: prints what it would write)
 *   npx tsx scripts/autofill-project-content.ts --execute  (writes)
 *   … --company=<id>   only one company's projects
 */
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { runAsPlatform, runInCompany } from '../src/common/tenant/tenant-context';
import { PlanTemplatesService } from '../src/modules/installments/installments.module';
import { servicesFromAmenities } from '../src/modules/projects/project-details';
import { loadAutofill, suggestContent } from '../src/modules/projects/project-autofill-input';

const EXECUTE = process.argv.includes('--execute');
const ONLY_COMPANY = process.argv.find((a) => a.startsWith('--company='))?.split('=')[1];


async function main() {
  console.log(EXECUTE ? '⚠️  EXECUTE — project content will be written.' : 'ℹ️  DRY-RUN — nothing is written. Pass --execute to apply.');
  // Built by hand (tsx has no decorator metadata for Nest's injection): the
  // tenant-scoped client and the plans service the project page uses.
  const prisma = new PrismaService();
  await prisma.onModuleInit();
  const plans = new PlanTemplatesService(prisma, undefined as never);
  let changed = 0;
  const loadProjects = () =>
    runAsPlatform(() =>
      prisma.project.findMany({
        where: { companyId: ONLY_COMPANY ? ONLY_COMPANY : { not: null } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, companyId: true },
      }),
    );
  type ProjectRow = Awaited<ReturnType<typeof loadProjects>>[number];
  try {
    const projects = await loadProjects();
    for (const p of projects) {
      const companyId = p.companyId!;
      // Everything for one project runs inside its company.
      if (await runInCompany(companyId, () => fillOne(p, companyId))) changed += 1;
    }
    console.log(`\n${changed} project(s) ${EXECUTE ? 'updated' : 'would be updated'}. Construction progress is not filled — add the stages per project from «محتوى صفحة المشروع».`);
  } finally {
    await prisma.$disconnect();
  }

  async function fillOne(p: ProjectRow, companyId: string): Promise<boolean> {
    const { name, input, current } = await loadAutofill(prisma, p.id, companyId, (id) => plans.customerPlansForProject(id));
    const suggested = suggestContent(input);
    const data: Prisma.ProjectUpdateInput = {};
    const report: string[] = [];
    if (current.sections.length === 0 && suggested.sections.length) {
      data.sections = suggested.sections as unknown as Prisma.InputJsonValue;
      report.push(`sections: ${suggested.sections.map((x) => x.title.ar).join(' / ')}`);
    }
    if (current.faqs.length === 0 && suggested.faqs.length) {
      data.faqs = suggested.faqs as unknown as Prisma.InputJsonValue;
      report.push(`faq: ${suggested.faqs.length} answered`);
    }
    const newIcons = suggested.amenities.filter((a, i) => a.icon !== current.amenities[i]!.icon);
    if (newIcons.length) {
      data.amenities = suggested.amenities as unknown as Prisma.InputJsonValue;
      data.services = servicesFromAmenities(suggested.amenities) as unknown as Prisma.InputJsonValue;
      report.push(`icons: ${newIcons.map((a) => `${a.name.ar}→${a.icon}`).join(', ')}`);
    }
    if (report.length === 0) return false;
    console.log(`\n• ${name.ar} (${p.id})\n  ${report.join('\n  ')}`);
    if (EXECUTE) await prisma.project.update({ where: { id: p.id }, data });
    return true;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
