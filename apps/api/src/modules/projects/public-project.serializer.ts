import type { Project, ProjectMedia } from '@prisma/client';

/**
 * Public-safe project shapes for the marketing website. These deliberately
 * whitelist fields by hand: never spread a raw Prisma entity into a public
 * response, so that future columns (and relations like leads/reservations)
 * cannot leak by accident.
 */

type MediaLike = Pick<ProjectMedia, 'url' | 'type' | 'order'>;

/** Aggregated unit statistics computed by ProjectsService for staff list. */
export interface StaffProjectSummary {
  totalUnitsCount: number;
  availableUnitsCount: number;
  soldUnitsCount: number;
  /** Min price (as JS number) of all AVAILABLE units, or null if no units. */
  startingPrice: number | null;
  /** Distinct unit type strings across all units in the project. */
  unitTypes: Set<string>;
}

interface ProjectListInput extends Pick<
  Project,
  'id' | 'name' | 'description' | 'city' | 'lat' | 'lng' | 'services' | 'featured' | 'status'
> {
  media?: MediaLike[];
}

interface ProjectDetailInput extends ProjectListInput {
  media?: MediaLike[];
}

function serializeMedia(media: MediaLike[] | undefined) {
  return (media ?? []).map((m) => ({ url: m.url, type: m.type, order: m.order }));
}

export function serializePublicProjectListItem(
  project: ProjectListInput,
  availableUnitsCount: number,
) {
  const media = serializeMedia(project.media);
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    city: project.city,
    lat: project.lat,
    lng: project.lng,
    services: project.services,
    featured: project.featured,
    status: project.status,
    coverImage: media[0]?.url ?? null,
    availableUnitsCount,
  };
}

/**
 * Staff list shape: richer than the public shape (includes unit aggregates and
 * all statuses), but still whitelisted — no leads, brokerCommissions, etc.
 *
 * Fields deliberately omitted (not in schema):
 *   • currency       — no column exists
 *   • deliveryDate   — no column on Project or Phase
 *   • address        — exists on Unit, not on Project
 */
export function serializeStaffProjectListItem(
  project: ProjectListInput,
  summary?: StaffProjectSummary,
) {
  const media = serializeMedia(project.media);
  return {
    id: project.id,
    name: project.name,
    city: project.city,
    status: project.status,
    media,
    coverImageUrl: media[0]?.url ?? null,
    availableUnitsCount: summary?.availableUnitsCount ?? null,
    totalUnitsCount: summary?.totalUnitsCount ?? null,
    soldUnitsCount: summary?.soldUnitsCount ?? null,
    startingPrice: summary?.startingPrice ?? null,
    unitTypes: summary ? [...summary.unitTypes] : [],
  };
}

export function serializePublicProjectDetail(
  project: ProjectDetailInput,
  availableUnitsCount: number,
) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    city: project.city,
    lat: project.lat,
    lng: project.lng,
    services: project.services,
    featured: project.featured,
    status: project.status,
    media: serializeMedia(project.media),
    availableUnitsCount,
  };
}
