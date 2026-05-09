import { z } from 'zod';

export const CreateReservationSchema = z.object({
  unitId: z.string().uuid(),
  leadId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  notes: z.string().optional(),
  expiresInHours: z.number().int().min(1).max(720).default(72),
});
export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

export const RecordDepositSchema = z.object({
  contractId: z.string().uuid(),
  installmentId: z.string().uuid().optional(),
  amount: z.number().positive(),
  paidAt: z.string().datetime().optional(),
  receiptUrl: z.string().url().optional(),
});
export type RecordDepositInput = z.infer<typeof RecordDepositSchema>;

export const CreateInstallmentPlanSchema = z.object({
  contractId: z.string().uuid(),
  totalMonths: z.number().int().min(1).max(360),
  monthlyAmount: z.number().positive(),
  startsAt: z.string().datetime(),
});
export type CreateInstallmentPlanInput = z.infer<typeof CreateInstallmentPlanSchema>;
