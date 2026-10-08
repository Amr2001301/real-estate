import type { PortalUnit } from './types';

/**
 * Robust project-id resolver for a portal unit. Portal payloads nest the
 * project under building.phase (exposing both `projectId` and `project.id`),
 * but a flat `projectId`/`project.id` may also appear depending on the
 * endpoint. We fall back across all known shapes so a schema tweak can't
 * silently break project→unit filtering on the portal forms.
 */
export function getUnitProjectId(u: PortalUnit): string {
  const flat = u as { projectId?: string; project?: { id?: string } };
  return (
    flat.projectId ??
    flat.project?.id ??
    u.building?.phase?.projectId ??
    u.building?.phase?.project?.id ??
    ''
  );
}

/**
 * The lead's unit of interest, looked up in the broker's own unit list
 * (/portal/units is broker-scoped), or null when this broker can't see it
 * any more — or, with `status`, when it is no longer in that status.
 *
 * The portal forms search units on the server instead of preloading a page,
 * so "is the lead's unit still offerable?" is answered with one narrow query
 * by code inside the lead's project.
 */
export async function findPortalUnit(
  lead: { unitInterestId: string | null; unitInterest?: { code: string } | null; projectInterestId: string | null },
  status?: string,
): Promise<PortalUnit | null> {
  const code = lead.unitInterest?.code;
  if (!lead.unitInterestId || !code || !lead.projectInterestId) return null;
  const qs = new URLSearchParams({ projectId: lead.projectInterestId, q: code, pageSize: '20' });
  if (status) qs.set('status', status);
  try {
    const res = await fetch(`/api-proxy/portal/units?${qs.toString()}`, {
      credentials: 'include',
      headers: { 'X-Raw-Translatable': '1' },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: PortalUnit[] };
    return (body.data ?? []).find((u) => u.id === lead.unitInterestId) ?? null;
  } catch {
    return null;
  }
}
