import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { UnitsService } from '../../../units/units.service';
import { ProjectsService } from '../../../projects/projects.service';
import {
  CatalogSearchTool,
  buildProjectQuery,
  buildUnitQuery,
  toProjectCard,
  toUnitCard,
  type CatalogFacets,
  type CatalogSearchResult,
  type PublicProjectLike,
  type PublicUnitLike,
} from './catalog-search';
import { cityLabelForCatalog, typeKeyForCatalog } from './catalog-taxonomy';
import { PROPERTY_TYPE_LABELS } from './responses';
import type { Slots } from './slots';

/** Paginated public list shape returned by UnitsService/ProjectsService.findAll. */
interface PaginatedPublic<T> {
  data: T[];
  meta: { total: number };
}

const FACETS_TTL_MS = 60_000;

/**
 * Real catalog search: delegates to the existing PUBLIC list methods (findAll
 * with publicOnly=true) so availability/published rules and field redaction are
 * enforced by the same serializers the website uses. Multi-value city/type are
 * handled by the `cityIn`/`typeIn` filters in one query. No fabricated data.
 */
@Injectable()
export class CatalogSearchService extends CatalogSearchTool {
  private facetsCache: { at: number; value: CatalogFacets } | null = null;

  constructor(
    private readonly units: UnitsService,
    private readonly projects: ProjectsService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async searchUnits(slots: Slots): Promise<CatalogSearchResult> {
    const query = buildUnitQuery(slots);
    const res = (await this.units.findAll(query as never, true)) as PaginatedPublic<PublicUnitLike>;
    return { cards: dedupeById(res.data.map(toUnitCard)), total: res.meta.total };
  }

  async searchProjects(slots: Slots): Promise<CatalogSearchResult> {
    const query = buildProjectQuery(slots);
    const res = (await this.projects.findAll(
      query as never,
      true,
    )) as PaginatedPublic<PublicProjectLike>;
    return { cards: dedupeById(res.data.map(toProjectCard)), total: res.meta.total };
  }

  /**
   * Distinct cities (with available stock) and unit types in the catalog,
   * mapped to clean Arabic labels. Cached briefly so prompts stay cheap.
   */
  async getFacets(): Promise<CatalogFacets> {
    if (this.facetsCache && Date.now() - this.facetsCache.at < FACETS_TTL_MS) {
      return this.facetsCache.value;
    }
    const rows = await this.prisma.unit.findMany({
      where: { status: 'AVAILABLE', building: { phase: { project: { status: 'PUBLISHED' } } } },
      select: { type: true, building: { select: { phase: { select: { project: { select: { city: true } } } } } } },
    });

    const cityLabels = new Set<string>();
    const typeLabels = new Set<string>();
    for (const r of rows) {
      const city = r.building?.phase?.project?.city;
      if (city) cityLabels.add(cityLabelForCatalog(city));
      const key = r.type ? typeKeyForCatalog(r.type) : undefined;
      if (key && PROPERTY_TYPE_LABELS[key]) typeLabels.add(PROPERTY_TYPE_LABELS[key]);
    }
    const value: CatalogFacets = { cities: [...cityLabels], types: [...typeLabels] };
    this.facetsCache = { at: Date.now(), value };
    return value;
  }
}

/** Keep the first card per id (defensive dedupe for any merged result set). */
function dedupeById(cards: CatalogSearchResult['cards']): CatalogSearchResult['cards'] {
  const seen = new Set<string>();
  return cards.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}
