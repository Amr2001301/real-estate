import { Type } from 'class-transformer';
import { IsIn, IsInt, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

/**
 * A project's page content beyond its description (sections, FAQ, amenities
 * with an icon and a group, construction progress by stage). The canonical
 * lists live in packages/shared-types/src/project-details.ts; the copy here
 * keeps the API build free of workspace sources, and project-details.spec.ts
 * checks the two stay the same.
 */

export const AMENITY_ICONS = [
  'pool', 'gym', 'garden', 'park', 'tree', 'playground', 'kids', 'security', 'cctv', 'parking',
  'elevator', 'clubhouse', 'mall', 'shop', 'restaurant', 'cafe', 'mosque', 'church', 'school',
  'university', 'hospital', 'clinic', 'pharmacy', 'bank', 'sea', 'lake', 'view', 'jogging', 'bike',
  'sports', 'tennis', 'football', 'spa', 'wifi', 'solar', 'smart-home', 'generator', 'hotel',
  'office', 'metro', 'road', 'airport', 'location', 'building', 'star', 'check',
] as const;
export type AmenityIcon = (typeof AMENITY_ICONS)[number];

export const AMENITY_GROUPS = ['INSIDE', 'AROUND'] as const;
export type AmenityGroup = (typeof AMENITY_GROUPS)[number];

export const PROJECT_DETAIL_LIMITS = {
  sections: 20,
  sectionTitle: 120,
  sectionBody: 4000,
  faqs: 30,
  question: 300,
  answer: 3000,
  amenities: 40,
  amenityName: 120,
  stages: 15,
  stageName: 120,
} as const;
const L = PROJECT_DETAIL_LIMITS;

type Text = { ar: string; en: string };
export interface ProjectSection { title: Text; body: Text }
export interface ProjectFaq { question: Text; answer: Text }
export interface ProjectAmenity { name: Text; icon: AmenityIcon; group: AmenityGroup }
export interface ProgressStage { name: Text; percent: number }

// ── Validation ────────────────────────────────────────────────────────────────

class ShortTextDto {
  @IsString() @MaxLength(L.sectionTitle) ar!: string;
  @IsString() @MaxLength(L.sectionTitle) en!: string;
}
class BodyTextDto {
  @IsString() @MaxLength(L.sectionBody) ar!: string;
  @IsString() @MaxLength(L.sectionBody) en!: string;
}
class QuestionTextDto {
  @IsString() @MaxLength(L.question) ar!: string;
  @IsString() @MaxLength(L.question) en!: string;
}
class AnswerTextDto {
  @IsString() @MaxLength(L.answer) ar!: string;
  @IsString() @MaxLength(L.answer) en!: string;
}

export class ProjectSectionDto {
  @ValidateNested() @Type(() => ShortTextDto) title!: ShortTextDto;
  @ValidateNested() @Type(() => BodyTextDto) body!: BodyTextDto;
}

export class ProjectFaqDto {
  @ValidateNested() @Type(() => QuestionTextDto) question!: QuestionTextDto;
  @ValidateNested() @Type(() => AnswerTextDto) answer!: AnswerTextDto;
}

export class ProjectAmenityDto {
  @ValidateNested() @Type(() => ShortTextDto) name!: ShortTextDto;
  @IsIn(AMENITY_ICONS as unknown as string[]) icon!: AmenityIcon;
  @IsIn(AMENITY_GROUPS as unknown as string[]) group!: AmenityGroup;
}

export class ProgressStageDto {
  @ValidateNested() @Type(() => ShortTextDto) name!: ShortTextDto;
  @IsInt() @Min(0) @Max(100) percent!: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** The overall progress: the stages' average, rounded; null with no stages. */
export function overallProgress(stages: ReadonlyArray<{ percent: number }>): number | null {
  if (stages.length === 0) return null;
  return Math.round(stages.reduce((sum, s) => sum + s.percent, 0) / stages.length);
}

/** A stored JSON column read back as an array (anything else → []). */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * The old `services` list (names only) the amenities replace: kept in step on
 * every write so clients that still read `services` show the same names.
 */
export function servicesFromAmenities(amenities: ReadonlyArray<ProjectAmenity>): Text[] {
  return amenities.map((a) => ({ ar: a.name.ar, en: a.name.en }));
}

/**
 * Amenities for a client that still writes the names-only `services`: each
 * name keeps the icon and group it already had (matched on its Arabic name),
 * else a plain tick inside the project.
 */
export function amenitiesFromServices(services: ReadonlyArray<Text>, existing: ReadonlyArray<ProjectAmenity>): ProjectAmenity[] {
  const byName = new Map(existing.map((a) => [a.name.ar.trim(), a]));
  return services.map((s) => {
    const prev = byName.get(s.ar.trim());
    return { name: { ar: s.ar, en: s.en }, icon: prev?.icon ?? 'check', group: prev?.group ?? 'INSIDE' };
  });
}

/** Whether two stage lists differ (names or percents) — a change moves «آخر تحديث». */
export function stagesChanged(a: ReadonlyArray<ProgressStage>, b: ReadonlyArray<ProgressStage>): boolean {
  if (a.length !== b.length) return true;
  return a.some((s, i) => s.percent !== b[i]!.percent || s.name.ar !== b[i]!.name.ar || s.name.en !== b[i]!.name.en);
}

/** The progress block a page shows, or null when the project lists no stages. */
export function serializeProgress(stagesRaw: unknown, updatedAt: Date | null) {
  const stages = asArray<ProgressStage>(stagesRaw);
  const overall = overallProgress(stages);
  if (overall === null) return null;
  return {
    overall,
    stages: stages.map((s) => ({ name: s.name, percent: s.percent })),
    updatedAt: updatedAt ? updatedAt.toISOString() : null,
  };
}
