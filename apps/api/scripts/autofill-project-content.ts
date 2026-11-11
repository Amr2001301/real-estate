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
import { Prisma, UnitStatus } from '@prisma/client';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { runAsPlatform, runInCompany } from '../src/common/tenant/tenant-context';
import { PlanTemplatesService } from '../src/modules/installments/installments.module';
import { asArray, servicesFromAmenities, type ProjectAmenity, type ProjectFaq, type ProjectSection } from '../src/modules/projects/project-details';
import { autofillAmenityIcons, autofillFaqs, autofillSections, type AutofillInput } from '../src/modules/projects/project-autofill';

const EXECUTE = process.argv.includes('--execute');
const ONLY_COMPANY = process.argv.find((a) => a.startsWith('--company='))?.split('=')[1];

type Text = { ar: string; en: string };
const text = (v: unknown): Text => {
  if (v && typeof v === 'object') {
    const o = v as Partial<Text>;
    return { ar: String(o.ar ?? ''), en: String(o.en ?? '') };
  }
  return { ar: String(v ?? ''), en: String(v ?? '') };
};

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
      select: {
        id: true, companyId: true, name: true, city: true, district: true, type: true, totalArea: true, licenseNumber: true,
        sections: true, faqs: true, amenities: true,
        phases: {
          orderBy: { createdAt: 'asc' },
          select: { name: true, deliveryDate: true, buildings: { select: { units: { select: { type: true, area: true, status: true } } } } },
        },
      },
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
      const sections = asArray<ProjectSection>(p.sections);
      const faqs = asArray<ProjectFaq>(p.faqs);
      const amenities = asArray<ProjectAmenity>(p.amenities);
      const units = p.phases.flatMap((ph) => ph.buildings.flatMap((b) => b.units));
      const typeNames = new Map(
        (await prisma.unitType.findMany({ where: { companyId }, select: { code: true, name: true } })).map((t) => [t.code.toLowerCase(), text(t.name)]),
      );
      const summary = await plans.customerPlansForProject(p.id).catch(() => null);
      const offers = summary?.offers ?? [];
      const input: AutofillInput = {
        name: text(p.name),
        city: p.city,
        district: p.district,
        type: p.type,
        totalArea: p.totalArea,
        licenseNumber: p.licenseNumber,
        units: units.map((u) => ({
          type: u.type,
          typeName: typeNames.get(u.type.toLowerCase()) ?? { ar: u.type, en: u.type },
          area: Number(u.area),
          available: u.status === UnitStatus.AVAILABLE,
        })),
        phases: p.phases.map((ph) => ({ name: text(ph.name), deliveryDate: ph.deliveryDate })),
        plans: {
          minDownPaymentPercent: summary?.minDownPaymentPercent ?? null,
          maxMonths: summary?.maxMonths ?? null,
          hasCash: offers.some((o) => o.isCash),
        },
        amenities,
      };

      const data: Prisma.ProjectUpdateInput = {};
      const report: string[] = [];
      if (sections.length === 0) {
        const s = autofillSections(input);
        if (s.length) {
          data.sections = s as unknown as Prisma.InputJsonValue;
          report.push(`sections: ${s.map((x) => x.title.ar).join(' / ')}`);
        }
      }
      if (faqs.length === 0) {
        const f = autofillFaqs(input);
        if (f.length) {
          data.faqs = f as unknown as Prisma.InputJsonValue;
          report.push(`faq: ${f.length} answered`);
        }
      }
      const iconed = autofillAmenityIcons(amenities);
      const newIcons = iconed.filter((a, i) => a.icon !== amenities[i]!.icon);
      if (newIcons.length) {
        data.amenities = iconed as unknown as Prisma.InputJsonValue;
        data.services = servicesFromAmenities(iconed) as unknown as Prisma.InputJsonValue;
        report.push(`icons: ${newIcons.map((a) => `${a.name.ar}→${a.icon}`).join(', ')}`);
      }
      if (report.length === 0) return false;
      console.log(`\n• ${text(p.name).ar} (${p.id})\n  ${report.join('\n  ')}`);
      if (EXECUTE) await prisma.project.update({ where: { id: p.id }, data });
      return true;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
