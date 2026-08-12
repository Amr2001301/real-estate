import { Prisma } from '@prisma/client';
import type { Unit, UnitMedia, UnitStatus } from '@prisma/client';


/**
 * Public-safe unit shapes for the marketing website + client-side comparison.
 * Hand-whitelisted: never expose `history` (status-change reasons + actor),
 * `reservationExpiresAt`, or raw building/reservation/contract relations.
 */

type MediaLike = Pick<UnitMedia, 'url' | 'type' | 'order'>;

interface ProjectSummaryInput {
  id: string;
  name: Prisma.JsonValue;
  city: string;
}

interface UnitInput extends Pick<
  Unit,
  'id' | 'code' | 'type' | 'area' | 'bedrooms' | 'bathrooms' | 'floor' | 'price' | 'status' | 'updatedAt'
> {
  media?: MediaLike[];
  project?: ProjectSummaryInput | null;
}

function serializeMedia(media: MediaLike[] | undefined) {
  return (media ?? []).map((m) => ({ url: m.url, type: m.type, order: m.order }));
}

function price(value: Unit['price']): string {
  return new Prisma.Decimal(value ?? 0).toString();
}

function projectSummary(project: ProjectSummaryInput | null | undefined) {
  if (!project) return null;
  return { id: project.id, name: project.name, city: project.city };
}

/**
 * The list and detail public unit shapes are intentionally identical: every
 * field needed for the comparison feature (price/area/beds/baths/floor/status/
 * type/project/main image) is present on both so client-side compare can rely
 * on either endpoint.
 */
export function serializePublicUnit(unit: UnitInput) {
  const media = serializeMedia(unit.media);
  return {
    id: unit.id,
    code: unit.code,
    type: unit.type,
    area: unit.area,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms,
    floor: unit.floor,
    price: price(unit.price),
    status: unit.status as UnitStatus,
    coverImage: media[0]?.url ?? null,
    media,
    project: projectSummary(unit.project),
    updatedAt: unit.updatedAt.toISOString(),
  };
}
