import { z } from 'zod';
import { TranslatableSchema } from './translatable';
import { ProjectStatus } from './enums';

export const CreateProjectSchema = z.object({
  name: TranslatableSchema,
  description: TranslatableSchema,
  city: z.string().min(1),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  status: z.nativeEnum(ProjectStatus).default(ProjectStatus.DRAFT),
  featured: z.boolean().default(false),
  services: z.array(TranslatableSchema).default([]),
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = CreateProjectSchema.partial();
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export const ProjectFilterSchema = z.object({
  city: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  featured: z.coerce.boolean().optional(),
  q: z.string().optional(),
});
export type ProjectFilter = z.infer<typeof ProjectFilterSchema>;
