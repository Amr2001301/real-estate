import { z } from 'zod';

export const LoginEmailSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginEmailInput = z.infer<typeof LoginEmailSchema>;

export const OtpRequestSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/),
});
export type OtpRequestInput = z.infer<typeof OtpRequestSchema>;

export const OtpVerifySchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/),
  code: z.string().length(6),
  fullName: z.string().min(2).optional(),
});
export type OtpVerifyInput = z.infer<typeof OtpVerifySchema>;

export const RefreshSchema = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshInput = z.infer<typeof RefreshSchema>;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthPayload {
  user: {
    id: string;
    role: 'ADMIN' | 'SALES' | 'CLIENT' | 'CUSTOMER' | 'BROKER';
    fullName: string;
    email: string | null;
    phone: string | null;
    locale: 'ar' | 'en';
  };
  tokens: AuthTokens;
}
