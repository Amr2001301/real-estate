'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';

export interface BrandingPayload {
  displayName?: string;
  tagline?: { ar?: string; en?: string };
  logoUrl?: string;
  faviconUrl?: string;
  ogImageUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWhatsApp?: string;
  contactAddress?: { ar?: string; en?: string };
  officeHours?: { ar?: string; en?: string };
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
    tiktok?: string;
  };
  registrationNumber?: string;
}

export type BrandingActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function patchBrandingAction(
  payload: BrandingPayload,
): Promise<BrandingActionResult> {
  try {
    await api.patch('/company/branding', payload);
    revalidatePath('/dashboard/company/branding');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? 'حدث خطأ غير متوقع.' };
  }
}
