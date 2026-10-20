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
  | 'id'
  | 'code'
  | 'type'
  | 'usage'
  | 'area'
  | 'netArea'
  | 'gardenArea'
  | 'roofArea'
  | 'terraceArea'
  | 'landArea'
  | 'finishing'
  | 'view'
  | 'orientation'
  | 'bedrooms'
  | 'bathrooms'
  | 'floor'
  | 'price'
  | 'pricePerMeter'
  | 'status'
  | 'updatedAt'
> {
  /** The type's name from the company's list ({ar,en}; flattened per locale). */
  typeName?: Prisma.JsonValue | null;
  /** The project's model the unit was entered from (F10). */
  model?: { code: string; name: Prisma.JsonValue } | null;
  /** Its handover date — its own, or its phase's (YYYY-MM-DD). */
  effectiveDeliveryDate?: string | null;
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
    typeName: unit.typeName ?? null,
    usage: unit.usage,
    model: unit.model ? { code: unit.model.code, name: unit.model.name } : null,
    deliveryDate: unit.effectiveDeliveryDate ?? null,
    area: unit.area,
    netArea: unit.netArea ?? null,
    gardenArea: unit.gardenArea ?? null,
    roofArea: unit.roofArea ?? null,
    terraceArea: unit.terraceArea ?? null,
    landArea: unit.landArea ?? null,
    finishing: unit.finishing ?? null,
    view: unit.view ?? null,
    orientation: unit.orientation ?? null,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms,
    floor: unit.floor,
    price: price(unit.price),
    pricePerMeter: unit.pricePerMeter != null ? price(unit.pricePerMeter) : null,
    status: unit.status as UnitStatus,
    coverImage: media[0]?.url ?? null,
    media,
    project: projectSummary(unit.project),
    updatedAt: unit.updatedAt.toISOString(),
  };
}
