import { NotFoundException } from '@nestjs/common';
import { UnitStatus, type PrismaClient } from '@prisma/client';
import { asArray, type ProjectAmenity, type ProjectFaq, type ProjectSection } from './project-details';
import { autofillAmenityIcons, autofillFaqs, autofillSections, type AutofillInput } from './project-autofill';

type Text = { ar: string; en: string };
const text = (v: unknown): Text => {
  if (v && typeof v === 'object') {
    const o = v as Partial<Text>;
    return { ar: String(o.ar ?? ''), en: String(o.en ?? '') };
  }
  return { ar: String(v ?? ''), en: String(v ?? '') };
};

/** The payment offers the project page shows (null when none can be read). */
export type PlansSummary = { minDownPaymentPercent: number | null; maxMonths: number | null; offers: Array<{ isCash: boolean }> } | null;

type Db = Pick<PrismaClient, 'project' | 'unitType'>;

/**
 * Reads what is recorded about a project — in the current tenant — into the
 * autofill input, with the content it already has.
 */
export async function loadAutofill(db: Db, projectId: string, companyId: string, plans: (projectId: string) => Promise<PlansSummary>) {
  const p = await db.project.findFirst({
    where: { id: projectId, companyId },
    select: {
      id: true, name: true, city: true, district: true, type: true, totalArea: true, licenseNumber: true,
      sections: true, faqs: true, amenities: true,
      phases: {
        orderBy: { createdAt: 'asc' },
        select: { name: true, deliveryDate: true, buildings: { select: { units: { select: { type: true, area: true, status: true } } } } },
      },
    },
  });
  if (!p) throw new NotFoundException('Project not found');
  const typeNames = new Map(
    (await db.unitType.findMany({ where: { companyId }, select: { code: true, name: true } })).map((t) => [t.code.toLowerCase(), text(t.name)]),
  );
  const summary = await plans(p.id).catch(() => null);
  const amenities = asArray<ProjectAmenity>(p.amenities);
  const input: AutofillInput = {
    name: text(p.name),
    city: p.city,
    district: p.district,
    type: p.type,
    totalArea: p.totalArea,
    licenseNumber: p.licenseNumber,
    units: p.phases.flatMap((ph) =>
      ph.buildings.flatMap((b) =>
        b.units.map((u) => ({
          type: u.type,
          typeName: typeNames.get(u.type.toLowerCase()) ?? { ar: u.type, en: u.type },
          area: Number(u.area),
          available: u.status === UnitStatus.AVAILABLE,
        })),
      ),
    ),
    phases: p.phases.map((ph) => ({ name: text(ph.name), deliveryDate: ph.deliveryDate })),
    plans: {
      minDownPaymentPercent: summary?.minDownPaymentPercent ?? null,
      maxMonths: summary?.maxMonths ?? null,
      hasCash: (summary?.offers ?? []).some((o) => o.isCash),
    },
    amenities,
  };
  return {
    name: input.name,
    input,
    current: {
      sections: asArray<ProjectSection>(p.sections),
      faqs: asArray<ProjectFaq>(p.faqs),
      amenities,
    },
  };
}

/** What the project's page content would be filled with from its records. */
export function suggestContent(input: AutofillInput) {
  return {
    sections: autofillSections(input),
    faqs: autofillFaqs(input),
    amenities: autofillAmenityIcons(input.amenities),
  };
}
