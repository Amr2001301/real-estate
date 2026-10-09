import { cache } from 'react';
import { api, safe } from './api';

/** The company identity printed on contracts, receipts and reservation slips. */
export interface Letterhead {
  name: string;
  displayName?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  tagline?: unknown;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: unknown;
  registrationNumber?: string;
  currency: string;
}

/**
 * GET /company/letterhead — open to every company role (the branding page's
 * GET /company/branding is ADMIN-only, so a sales agent's printout used to say
 * "شركتنا"). Falls back to a blank identity so a print never fails on it.
 */
export const getLetterhead = cache(async (): Promise<Letterhead> => {
  const res = await safe(api.get<Letterhead>('/company/letterhead'));
  return res.data ?? { name: '', currency: 'EGP' };
});
