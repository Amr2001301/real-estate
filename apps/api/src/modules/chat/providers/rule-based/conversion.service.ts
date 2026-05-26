import { Injectable } from '@nestjs/common';
import { RequestsService } from '../../../requests/requests.module';
import { UnitsService } from '../../../units/units.service';
import {
  ConversionTool,
  type CreateInfoInput,
  type CreateVisitInput,
} from './conversion';

/**
 * Creates info/visit requests through the existing public RequestsService — the
 * same authoritative path the website endpoints use (anonymous actor, so it
 * auto-resolves/creates a Lead from name+phone). The service re-validates and
 * owns persistence; this is a thin adapter that returns just the created id.
 */
@Injectable()
export class ConversionService extends ConversionTool {
  constructor(
    private readonly requests: RequestsService,
    private readonly units: UnitsService,
  ) {
    super();
  }

  async createInfoRequest(input: CreateInfoInput): Promise<{ id: string }> {
    const created = await this.requests.createInfoRequest(
      {
        message: input.message,
        name: input.name,
        phone: input.phone,
        projectId: input.projectId,
        unitId: input.unitId,
      },
      {}, // anonymous actor → backend links/creates the lead
    );
    return { id: created.id };
  }

  async createVisitRequest(input: CreateVisitInput): Promise<{ id: string }> {
    const created = await this.requests.createVisitRequest(
      {
        projectId: input.projectId,
        preferredDate: input.preferredDate,
        name: input.name,
        phone: input.phone,
        unitId: input.unitId,
        notes: input.notes,
      },
      {},
    );
    return { id: created.id };
  }

  async resolveUnitProjectId(unitId: string): Promise<string | null> {
    try {
      const unit = (await this.units.findOne(unitId, true)) as { project?: { id?: string } | null };
      return unit.project?.id ?? null;
    } catch {
      // NotFound / non-public unit → no project to attach.
      return null;
    }
  }
}
