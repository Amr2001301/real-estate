import type { Project, ProjectMedia } from '@prisma/client';

/**
 * Public-safe project shapes for the marketing website. These deliberately
 * whitelist fields by hand: never spread a raw Prisma entity into a public
 * response, so that future columns (and relations like leads/reservations)
 * cannot leak by accident.
 */

type MediaLike = Pick<ProjectMedia, 'url' | 'type' | 'order'>;

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
