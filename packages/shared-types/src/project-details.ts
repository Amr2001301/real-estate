import { z } from 'zod';
import { TranslatableSchema } from './translatable';

/**
 * A project's page content beyond its description: titled sections
 * (location, details, nearby services…), its own FAQ, amenities with an icon
 * and a group, and the construction progress by stage. Edited in the
 * dashboard, shown on the website and in the customer app.
 *
 * The API keeps a copy of AMENITY_ICONS and the limits
 * (apps/api/src/modules/projects/project-details.ts); a unit test there
 * checks the two stay the same.
 */

/** The icons an amenity can carry — each client maps a key to its own icon set. */
export const AMENITY_ICONS = [
  'pool', 'gym', 'garden', 'park', 'tree', 'playground', 'kids', 'security', 'cctv', 'parking',
  'elevator', 'clubhouse', 'mall', 'shop', 'restaurant', 'cafe', 'mosque', 'church', 'school',
  'university', 'hospital', 'clinic', 'pharmacy', 'bank', 'sea', 'lake', 'view', 'jogging', 'bike',
  'sports', 'tennis', 'football', 'spa', 'wifi', 'solar', 'smart-home', 'generator', 'hotel',
  'office', 'metro', 'road', 'airport', 'location', 'building', 'star', 'check',
] as const;
export type AmenityIcon = (typeof AMENITY_ICONS)[number];

/** Inside the project, or around it (nearby services and landmarks). */
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
const text = (max: number) => z.object({ ar: z.string().max(max), en: z.string().max(max) });

export const ProjectSectionSchema = z.object({ title: text(L.sectionTitle), body: text(L.sectionBody) });
export const ProjectFaqSchema = z.object({ question: text(L.question), answer: text(L.answer) });
export const ProjectAmenitySchema = z.object({
  name: text(L.amenityName),
  icon: z.enum(AMENITY_ICONS),
  group: z.enum(AMENITY_GROUPS),
});
export const ProgressStageSchema = z.object({ name: text(L.stageName), percent: z.number().int().min(0).max(100) });

export const ProjectDetailsSchema = z.object({
  sections: z.array(ProjectSectionSchema).max(L.sections),
  faqs: z.array(ProjectFaqSchema).max(L.faqs),
  amenities: z.array(ProjectAmenitySchema).max(L.amenities),
  progressStages: z.array(ProgressStageSchema).max(L.stages),
});

export type ProjectSection = z.infer<typeof ProjectSectionSchema>;
export type ProjectFaq = z.infer<typeof ProjectFaqSchema>;
export type ProjectAmenity = z.infer<typeof ProjectAmenitySchema>;
export type ProgressStage = z.infer<typeof ProgressStageSchema>;

/** The project's progress as the API sends it: its stages, their average and when it was last updated. */
export interface ProjectProgress {
  overall: number;
  stages: Array<{ name: z.infer<typeof TranslatableSchema> | string; percent: number }>;
  updatedAt: string | null;
}

/** The overall progress: the stages' average, rounded; null with no stages. */
export function overallProgress(stages: ReadonlyArray<{ percent: number }>): number | null {
  if (stages.length === 0) return null;
  return Math.round(stages.reduce((sum, s) => sum + s.percent, 0) / stages.length);
}
