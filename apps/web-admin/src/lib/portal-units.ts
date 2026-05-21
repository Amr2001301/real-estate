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
