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
// Client has a generic open opportunity (no project, no unit, no reservations,
// no unit-specific appointments). A project-scoped action should UPGRADE the
// generic one — no duplicate created.
describe('Scenario 1: clean generic opportunity + project action → upgrades generic, no duplicate', () => {
  let tx: ReturnType<typeof makeTx>;

  beforeEach(async () => {
    // Tier 1 (unit-101): null  →  Tier 2 (clean generic): found
    tx = makeTx([null, { id: EXISTING_LEAD_ID, stage: LeadStage.NEW }]);
    await matchOrCreateLeadForClient(tx as any, BASE_OPTS);
  });

  it('returns the existing lead id', async () => {
    tx = makeTx([null, { id: EXISTING_LEAD_ID, stage: LeadStage.NEW }]);
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

// ─── Scenario 1b ──────────────────────────────────────────────────────────────
// Client has a generic open opportunity BUT it already has a reservation or
// unit-specific appointment attached. The DB's `reservations: { none: {} }`
// and `appointments: { none: { unitId: { not: null } } }` guards filter it
// out (Tier 2 returns null). A fresh unit-scoped opportunity is created instead.
describe('Scenario 1b: generic lead with committed activity → creates new (safety guard)', () => {
  let tx: ReturnType<typeof makeTx>;
  let result: Awaited<ReturnType<typeof matchOrCreateLeadForClient>>;

  beforeEach(async () => {
    // Tier 1 (unit-101): null
    // Tier 2 (generic): null — DB filters out the generic lead that has a reservation
    tx = makeTx([null, null]);
    result = await matchOrCreateLeadForClient(tx as any, BASE_OPTS);
  });

  it('returns a new lead (isNew=true)', () => {
    expect(result).toEqual({ leadId: NEW_LEAD_ID, isNew: true });
  });

  it('does NOT update the committed generic lead', () => {
    expect(tx.lead.update).not.toHaveBeenCalled();
  });

  it('creates a new unit-scoped opportunity', () => {
    expect(tx.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: CLIENT_ID,
          unitInterestId: UNIT_101,
          projectInterestId: PROJECT_A,
          stage: LeadStage.NEGOTIATION,
        }),
      }),
    );
  });
});

// ─── Scenario 2 ───────────────────────────────────────────────────────────────
// Client has a Unit-102 lead in Project A. Action is on Unit-101.
// The old Tier-2 project-level merge (Bug A) would have incorrectly reused the
// Unit-102 lead. With Tier 2 removed, a separate opportunity is created for
// Unit-101 and the Unit-102 lead remains untouched.
describe('Scenario 2: different unit in same project → creates new opportunity (no cross-unit merge)', () => {
  let tx: ReturnType<typeof makeTx>;
  let result: Awaited<ReturnType<typeof matchOrCreateLeadForClient>>;

  beforeEach(async () => {
    // Tier 1 (unit-101): null — only a unit-102 lead exists
    // Tier 2 (generic):  null — the unit-102 lead is not generic
    tx = makeTx([null, null]);
    result = await matchOrCreateLeadForClient(tx as any, BASE_OPTS);
  });

  it('returns a new lead id (isNew=true)', () => {
    expect(result).toEqual({ leadId: NEW_LEAD_ID, isNew: true });
  });

  it('creates a new opportunity for Unit-101 (does not reuse the Unit-102 lead)', () => {
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

  it('does NOT update any existing lead', () => {
    expect(tx.lead.update).not.toHaveBeenCalled();
  });

  it('runs exactly Tier 1 + Tier 2 queries (2 findFirst calls)', () => {
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
    // Tier 2 (generic): null — only a Project B lead exists, not generic
    tx = makeTx([null, null]);
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

  it('tier-1 match skips tier-2 query', () => {
    // Only one findFirst call (tier 1 found immediately)
    expect(tx101.lead.findFirst).toHaveBeenCalledTimes(1);
    expect(tx102.lead.findFirst).toHaveBeenCalledTimes(1);
  });
});
