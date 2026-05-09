import { z } from 'zod';
import { LeadStage } from './enums';

export const CreateLeadSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(7),
  email: z.string().email().optional(),
  sourceId: z.string().uuid().optional(),
  projectInterestId: z.string().uuid().optional(),
  assignedSalesId: z.string().uuid().optional(),
  notes: z.string().optional(),
});
export type CreateLeadInput = z.infer<typeof CreateLeadSchema>;

export const UpdateLeadStageSchema = z.object({
  stage: z.nativeEnum(LeadStage),
  reason: z.string().optional(),
});
export type UpdateLeadStageInput = z.infer<typeof UpdateLeadStageSchema>;

export const AssignLeadSchema = z.object({
  assignedSalesId: z.string().uuid(),
});
export type AssignLeadInput = z.infer<typeof AssignLeadSchema>;
