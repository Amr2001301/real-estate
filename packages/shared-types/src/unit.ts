import { z } from 'zod';
import { UnitStatus } from './enums';

export const CreateUnitSchema = z.object({
  buildingId: z.string().uuid(),
  code: z.string().min(1),
  type: z.string().min(1),
  area: z.number().positive(),
  bedrooms: z.number().int().min(0),
  bathrooms: z.number().int().min(0),
  floor: z.number().int().min(0),
  price: z.number().positive(),
  status: z.nativeEnum(UnitStatus).default(UnitStatus.AVAILABLE),
});
export type CreateUnitInput = z.infer<typeof CreateUnitSchema>;

export const UpdateUnitSchema = CreateUnitSchema.partial();
export type UpdateUnitInput = z.infer<typeof UpdateUnitSchema>;

export const UnitFilterSchema = z.object({
  projectId: z.string().uuid().optional(),
  buildingId: z.string().uuid().optional(),
  status: z.nativeEnum(UnitStatus).optional(),
  priceMin: z.coerce.number().optional(),
  priceMax: z.coerce.number().optional(),
  areaMin: z.coerce.number().optional(),
  areaMax: z.coerce.number().optional(),
  bedrooms: z.coerce.number().int().optional(),
});
export type UnitFilter = z.infer<typeof UnitFilterSchema>;

export interface InstallmentCalcInput {
  totalPrice: number;
  downPayment: number;
  totalMonths: number;
}

export interface InstallmentCalcResult {
  monthlyAmount: number;
  schedule: Array<{ month: number; amount: number; cumulative: number }>;
}
