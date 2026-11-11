import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AMENITY_GROUPS,
  AMENITY_ICONS,
  PROJECT_DETAIL_LIMITS,
  amenitiesFromServices,
  overallProgress,
  serializeProgress,
  servicesFromAmenities,
  stagesChanged,
  type ProjectAmenity,
} from './project-details';
import { UpdateProjectDto } from './dto/project.dto';
import { serializePublicProjectDetail } from './public-project.serializer';

const t = (ar: string, en = ar) => ({ ar, en });

/**
 * The shared copy, read as text: the API build (rootDir src) may not import
 * workspace sources, so the lists are parsed out of the file instead.
 */
const sharedSource = readFileSync(join(__dirname, '../../../../../packages/shared-types/src/project-details.ts'), 'utf8');
const quotedList = (name: string) => {
  const m = sharedSource.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`));
  return [...(m?.[1] ?? '').matchAll(/'([^']+)'/g)].map((x) => x[1]);
};
const sharedLimits = () => {
  const m = sharedSource.match(/export const PROJECT_DETAIL_LIMITS = \{([\s\S]*?)\} as const/);
  return Object.fromEntries([...(m?.[1] ?? '').matchAll(/(\w+):\s*(\d+)/g)].map((x) => [x[1], Number(x[2])]));
};

describe('project page details', () => {
  it('keeps the same icons, groups and limits as packages/shared-types', () => {
    expect([...AMENITY_ICONS]).toEqual(quotedList('AMENITY_ICONS'));
    expect([...AMENITY_GROUPS]).toEqual(quotedList('AMENITY_GROUPS'));
    expect(PROJECT_DETAIL_LIMITS).toEqual(sharedLimits());
  });

  it('overall progress is the stages’ rounded average, null without stages', () => {
    expect(overallProgress([])).toBeNull();
    // The screenshot's stages: 100, 100, 100, 40, 55, 0 → 65.8 → 66
    expect(overallProgress([100, 100, 100, 40, 55, 0].map((percent) => ({ percent })))).toBe(66);
  });

  it('services follow the amenities, and old services keep each amenity’s icon and group', () => {
    const existing: ProjectAmenity[] = [{ name: t('حمام سباحة', 'Pool'), icon: 'pool', group: 'INSIDE' }];
    expect(servicesFromAmenities(existing)).toEqual([t('حمام سباحة', 'Pool')]);
    expect(amenitiesFromServices([t('حمام سباحة', 'Pool'), t('مدرسة', 'School')], existing)).toEqual([
      { name: t('حمام سباحة', 'Pool'), icon: 'pool', group: 'INSIDE' },
      { name: t('مدرسة', 'School'), icon: 'check', group: 'INSIDE' },
    ]);
  });

  it('a stage list changes on any name or percent', () => {
    const a = [{ name: t('الحفر'), percent: 100 }];
    expect(stagesChanged(a, [{ name: t('الحفر'), percent: 100 }])).toBe(false);
    expect(stagesChanged(a, [{ name: t('الحفر'), percent: 90 }])).toBe(true);
    expect(stagesChanged(a, [])).toBe(true);
  });

  it('serializes progress with its overall and date, or null with no stages', () => {
    expect(serializeProgress([], null)).toBeNull();
    const at = new Date('2026-11-01T10:00:00Z');
    expect(serializeProgress([{ name: t('الحفر'), percent: 100 }, { name: t('الخرسانات'), percent: 50 }], at)).toEqual({
      overall: 75,
      stages: [{ name: t('الحفر'), percent: 100 }, { name: t('الخرسانات'), percent: 50 }],
      updatedAt: '2026-11-01T10:00:00.000Z',
    });
  });

  describe('validation', () => {
    const check = async (body: object) => validate(plainToInstance(UpdateProjectDto, body));

    it('accepts well-formed sections, FAQ, amenities and stages', async () => {
      const errors = await check({
        sections: [{ title: t('الموقع الاستراتيجي'), body: t('على بعد دقائق من…') }],
        faqs: [{ question: t('أين يقع المشروع؟'), answer: t('في دمياط الجديدة') }],
        amenities: [{ name: t('حمام سباحة'), icon: 'pool', group: 'INSIDE' }],
        progressStages: [{ name: t('الحفر'), percent: 100 }],
      });
      expect(errors).toHaveLength(0);
    });

    it('rejects an unknown icon or group, a percent outside 0–100, and an over-long title', async () => {
      const errors = await check({
        amenities: [{ name: t('x'), icon: 'rocket', group: 'NEAR' }],
        progressStages: [{ name: t('x'), percent: 140 }],
        sections: [{ title: t('x'.repeat(PROJECT_DETAIL_LIMITS.sectionTitle + 1)), body: t('b') }],
      });
      expect(errors.map((e) => e.property).sort()).toEqual(['amenities', 'progressStages', 'sections']);
    });

    it('rejects more stages than the limit', async () => {
      const stages = Array.from({ length: PROJECT_DETAIL_LIMITS.stages + 1 }, () => ({ name: t('x'), percent: 1 }));
      expect((await check({ progressStages: stages })).map((e) => e.property)).toEqual(['progressStages']);
    });
  });

  it('the public project detail carries the sections, FAQ, amenities and progress', () => {
    const out = serializePublicProjectDetail(
      {
        id: 'p1',
        name: t('O7'),
        description: t('d'),
        city: 'دمياط الجديدة',
        type: null,
        district: null,
        totalArea: null,
        licenseNumber: null,
        lat: 0,
        lng: 0,
        services: [],
        featured: false,
        status: 'PUBLISHED',
        updatedAt: new Date('2026-11-01T00:00:00Z'),
        sections: [{ title: t('تفاصيل المشروع'), body: t('…') }],
        faqs: [{ question: t('س؟'), answer: t('ج') }],
        amenities: [{ name: t('حمام سباحة'), icon: 'pool', group: 'INSIDE' }],
        progressStages: [{ name: t('التراخيص'), percent: 100 }, { name: t('التسليمات'), percent: 0 }],
        progressUpdatedAt: null,
      },
      3,
    );
    expect(out.sections).toHaveLength(1);
    expect(out.faqs).toHaveLength(1);
    expect(out.amenities).toEqual([{ name: t('حمام سباحة'), icon: 'pool', group: 'INSIDE' }]);
    expect(out.progress).toEqual({ overall: 50, stages: expect.any(Array), updatedAt: null });
  });
});
