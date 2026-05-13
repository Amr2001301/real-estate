import { LeadStage } from '@prisma/client';
import { matchOrCreateLeadForClient } from '../crm-lead-matching';

const CLIENT_ID = 'client-abc';
const PROJECT_A = 'project-a';
const PROJECT_B = 'project-b';
const UNIT_101 = 'unit-101';
const UNIT_102 = 'unit-102';
const EXISTING_LEAD_ID = 'lead-existing';
const NEW_LEAD_ID = 'lead-new';

const BASE_OPTS = {
  clientId: CLIENT_ID,
  projectId: PROJECT_A,
  unitId: UNIT_101,
  bumpableStages: [LeadStage.NEW, LeadStage.INTERESTED, LeadStage.VISIT] as LeadStage[],
  targetStage: LeadStage.NEGOTIATION,
  clientFullName: 'Test Client',
  clientPhone: '0501234567',
  clientEmail: null,
  assignedSalesId: null,
};

/**
 * Build a minimal Prisma transaction mock.
 * `findResults` controls what each successive `lead.findFirst` call returns.
 */
function makeTx(findResults: Array<{ id: string; stage: LeadStage } | null>) {
  let call = 0;
  return {
    lead: {
      findFirst: jest.fn().mockImplementation(() => Promise.resolve(findResults[call++] ?? null)),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({ id: NEW_LEAD_ID }),
    },
    leadActivity: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
}

// ─── Scenario 1 ───────────────────────────────────────────────────────────────
// Client has a generic open opportunity (no project, no unit).
// A project-scoped action should UPGRADE the generic one — no duplicate.
describe('Scenario 1: generic opportunity + project action → upgrades generic, no duplicate', () => {
  let tx: ReturnType<typeof makeTx>;

  beforeEach(async () => {
    // Tier 1 (unit): null  →  Tier 2 (project): null  →  Tier 3 (generic): found
    tx = makeTx([null, null, { id: EXISTING_LEAD_ID, stage: LeadStage.NEW }]);
    await matchOrCreateLeadForClient(tx as any, BASE_OPTS);
  });

  it('returns the existing lead id', async () => {
    tx = makeTx([null, null, { id: EXISTING_LEAD_ID, stage: LeadStage.NEW }]);
    const result = await matchOrCreateLeadForClient(tx as any, BASE_OPTS);
    expect(result).toEqual({ leadId: EXISTING_LEAD_ID, isNew: false });
  });

  it('updates the generic lead with project + unit + targetStage', () => {
    expect(tx.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: EXISTING_LEAD_ID },
        data: expect.objectContaining({
          stage: LeadStage.NEGOTIATION,
          projectInterestId: PROJECT_A,
          unitInterestId: UNIT_101,
        }),
      }),
    );
  });

  it('does NOT create a new lead', () => {
    expect(tx.lead.create).not.toHaveBeenCalled();
  });

  it('logs a status_change activity with upgrade reason', () => {
    expect(tx.leadActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: EXISTING_LEAD_ID,
          type: 'status_change',
        }),
      }),
    );
  });
});

// ─── Scenario 2 ───────────────────────────────────────────────────────────────
// Client already has a Project A opportunity. Same-project action → update it.
describe('Scenario 2: existing Project A opportunity + Project A action → updates same opportunity', () => {
  let tx: ReturnType<typeof makeTx>;
  let result: Awaited<ReturnType<typeof matchOrCreateLeadForClient>>;

  beforeEach(async () => {
    // Tier 1 (unit): null  →  Tier 2 (project A): found
    tx = makeTx([null, { id: EXISTING_LEAD_ID, stage: LeadStage.INTERESTED }]);
    result = await matchOrCreateLeadForClient(tx as any, BASE_OPTS);
  });

  it('returns the existing lead id', () => {
    expect(result).toEqual({ leadId: EXISTING_LEAD_ID, isNew: false });
  });

  it('updates the existing lead stage only — no projectInterestId change', () => {
    expect(tx.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: EXISTING_LEAD_ID },
        data: expect.objectContaining({ stage: LeadStage.NEGOTIATION }),
      }),
    );
    const updateCall = tx.lead.update.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty('projectInterestId');
    expect(updateCall.data).not.toHaveProperty('unitInterestId');
  });

  it('does NOT create a new lead', () => {
    expect(tx.lead.create).not.toHaveBeenCalled();
  });

  it('does NOT run the tier-3 generic query', () => {
    // findFirst called at most twice: tier 1 (unit) + tier 2 (project)
    expect(tx.lead.findFirst).toHaveBeenCalledTimes(2);
  });
});

// ─── Scenario 3 ───────────────────────────────────────────────────────────────
// Client has a Project B opportunity. Project A action → create Project A; leave B alone.
describe('Scenario 3: Project B opportunity + Project A action → creates Project A, B untouched', () => {
  let tx: ReturnType<typeof makeTx>;
  let result: Awaited<ReturnType<typeof matchOrCreateLeadForClient>>;

  beforeEach(async () => {
    // Tier 1 (unit-101 in project A): null
    // Tier 2 (project A): null  — only project B exists, not A
    // Tier 3 (generic): null
    tx = makeTx([null, null, null]);
    result = await matchOrCreateLeadForClient(tx as any, {
      ...BASE_OPTS,
      projectId: PROJECT_A,
      unitId: UNIT_101,
    });
  });

  it('returns a new lead id', () => {
    expect(result).toEqual({ leadId: NEW_LEAD_ID, isNew: true });
  });

  it('creates a new lead scoped to Project A + unit', () => {
    expect(tx.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: CLIENT_ID,
          projectInterestId: PROJECT_A,
          unitInterestId: UNIT_101,
          stage: LeadStage.NEGOTIATION,
        }),
      }),
    );
  });

  it('never touches Project B (no update called)', () => {
    expect(tx.lead.update).not.toHaveBeenCalled();
  });
});

// ─── Scenario 4 ───────────────────────────────────────────────────────────────
// Client has two unit opportunities in the same project.
// Action on Unit-101 must update Unit-101 opportunity only; Unit-102 untouched.
describe('Scenario 4: two unit opportunities in same project → updates matching unit only', () => {
  let tx101: ReturnType<typeof makeTx>;
  let tx102: ReturnType<typeof makeTx>;

  beforeEach(async () => {
    // Acting on Unit-101: Tier 1 finds it immediately
    tx101 = makeTx([{ id: 'lead-unit-101', stage: LeadStage.VISIT }]);
    await matchOrCreateLeadForClient(tx101 as any, { ...BASE_OPTS, unitId: UNIT_101 });

    // Acting on Unit-102: Tier 1 finds it immediately
    tx102 = makeTx([{ id: 'lead-unit-102', stage: LeadStage.NEW }]);
    await matchOrCreateLeadForClient(tx102 as any, { ...BASE_OPTS, unitId: UNIT_102 });
  });

  it('Unit-101 action updates lead-unit-101', () => {
    expect(tx101.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'lead-unit-101' } }),
    );
  });

  it('Unit-102 action updates lead-unit-102', () => {
    expect(tx102.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'lead-unit-102' } }),
    );
  });

  it('Unit-101 action does not touch lead-unit-102', () => {
    const updatedIds = tx101.lead.update.mock.calls.map((c: any) => c[0].where.id);
    expect(updatedIds).not.toContain('lead-unit-102');
  });

  it('tier-1 match skips tier-2 and tier-3 queries', () => {
    // Only one findFirst call (tier 1 found immediately)
    expect(tx101.lead.findFirst).toHaveBeenCalledTimes(1);
    expect(tx102.lead.findFirst).toHaveBeenCalledTimes(1);
  });
});
