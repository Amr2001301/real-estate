import { cache } from 'react';
import { api, safe } from './api';
import type { SessionRole } from './session';

interface EffectiveView {
  keys: Array<{ key: string; effective: unknown }>;
}

/**
 * The company's plan features that are switched off (e.g. "feature.maintenance"
 * on the Professional plan). The API refuses their endpoints; the dashboard
 * hides their pages instead of opening them onto a refusal.
 * GET /capabilities/me is ADMIN / SALES_MANAGER; other roles never see those
 * pages, so they get an empty set.
 */
export const getDisabledFeatures = cache(async (role: SessionRole): Promise<Set<string>> => {
  if (role !== 'ADMIN' && role !== 'SALES_MANAGER') return new Set();
  const res = await safe(api.get<EffectiveView>('/capabilities/me'));
  return new Set(
    (res.data?.keys ?? [])
      .filter((k) => k.key.startsWith('feature.') && k.effective === false)
      .map((k) => k.key),
  );
});
